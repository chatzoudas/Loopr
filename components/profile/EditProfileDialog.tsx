"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateProfile, deleteAccount } from "@/lib/actions/profile";
import { clearDeviceKeys } from "@/lib/crypto";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Cropper, { Area } from "react-easy-crop";

interface EditProfileDialogProps {
    profile: Profile;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const LANGUAGE_OPTIONS = [
    "C",
    "C#",
    "C++",
    "Delphi",
    "Java",
    "JavaScript",
    "Perl",
    "PHP",
    "Python",
    "Rust",
    "SQL",
    "Swift",
];

const LANGUAGE_ICONS: Record<string, string> = {
    "C": "/langicons/C.webp",
    "C#": "/langicons/C_.webp",
    "C++": "/langicons/C__.webp",
    "Delphi": "/langicons/Delphi_Object_Pascal.webp",
    "Java": "/langicons/Java.webp",
    "JavaScript": "/langicons/JavaScript.webp",
    "Perl": "/langicons/Perl.webp",
    "PHP": "/langicons/PHP.webp",
    "Python": "/langicons/Python.webp",
    "Rust": "/langicons/Rust.webp",
    "SQL": "/langicons/SQL.webp",
    "Swift": "/langicons/Swift.webp",
};

export function EditProfileDialog({ profile, open, onOpenChange }: EditProfileDialogProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const res = await deleteAccount();
            if (res.error) {
                toast.error(res.error);
                setIsDeleting(false);
            } else {
                await clearDeviceKeys();
                toast.success("Account deleted successfully");
                onOpenChange(false);
                router.push("/signin");
            }
        } catch (e) {
            toast.error("Failed to delete account");
            setIsDeleting(false);
        }
    };

    const [isDragActive, setIsDragActive] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(profile.tech_stack ?? []);
    const [customLanguage, setCustomLanguage] = useState("");

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const effectiveAvatarUrl = useMemo(() => {
        if (removeAvatar) return null;
        return avatarPreviewUrl ?? profile.avatar_url;
    }, [avatarPreviewUrl, profile.avatar_url, removeAvatar]);

    useEffect(() => {
        return () => {
            if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
        };
    }, [selectedImageSrc]);

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        };
    }, [avatarPreviewUrl]);

    useEffect(() => {
        if (!open) {
            setIsDragActive(false);
            setIsCropping(false);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
            if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
            setSelectedImageSrc(null);
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl(null);
            setAvatarFile(null);
            setRemoveAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open) {
            setSelectedLanguages(profile.tech_stack ?? []);
            setCustomLanguage("");
        }
    }, [open, profile.tech_stack]);

    const AVATAR_SIZE_PX = 200;

    async function createCroppedAvatarFile(imageSrc: string, area: Area) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = imageSrc;

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("Failed to load image"));
        });

        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE_PX;
        canvas.height = AVATAR_SIZE_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
            image,
            area.x,
            area.y,
            area.width,
            area.height,
            0,
            0,
            AVATAR_SIZE_PX,
            AVATAR_SIZE_PX
        );

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (b) => {
                    if (!b) return reject(new Error("Failed to crop image"));
                    resolve(b);
                },
                "image/png",
                0.92
            );
        });

        return new File([blob], "avatar.png", { type: "image/png" });
    }

    function beginCropFromFile(file: File) {
        if (!file.type.startsWith("image/")) {
            toast.error("Please choose an image file");
            return;
        }

        if (fileInputRef.current) fileInputRef.current.value = "";

        if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
        const objectUrl = URL.createObjectURL(file);
        setSelectedImageSrc(objectUrl);
        setIsCropping(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        setIsDragActive(false);
    }

    function onPickPhotoClick() {
        fileInputRef.current?.click();
    }

    async function onConfirmCrop() {
        if (!selectedImageSrc || !croppedAreaPixels) {
            toast.error("Pick a photo to continue");
            return;
        }

        try {
            const file = await createCroppedAvatarFile(selectedImageSrc, croppedAreaPixels);
            setAvatarFile(file);
            const nextPreview = URL.createObjectURL(file);
            setAvatarPreviewUrl(nextPreview);
            setRemoveAvatar(false);
            setIsCropping(false);
        } catch (e) {
            console.error(e);
            toast.error("Failed to prepare photo");
        }
    }

    function onRemovePhoto() {
        setRemoveAvatar(true);
        setAvatarFile(null);
        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
        setSelectedImageSrc(null);
        setIsCropping(false);
    }

    function toggleLanguage(language: string) {
        setSelectedLanguages((prev) => {
            if (prev.includes(language)) {
                return prev.filter((item) => item !== language);
            }
            return [...prev, language];
        });
    }

    function addCustomLanguage() {
        const next = customLanguage.trim();
        if (!next) return;
        if (selectedLanguages.includes(next)) {
            setCustomLanguage("");
            return;
        }
        setSelectedLanguages((prev) => [...prev, next]);
        setCustomLanguage("");
    }

    async function onSubmit(formData: FormData) {
        setIsLoading(true);
        try {
            if (removeAvatar) {
                formData.set("remove_avatar", "1");
                formData.delete("avatar_file");
            } else {
                formData.delete("remove_avatar");
                if (avatarFile) {
                    formData.set("avatar_file", avatarFile);
                }
            }
            await updateProfile(formData);
            toast.success("Profile updated");
            onOpenChange(false);
        } catch {
            toast.error("Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you&apos;re done.
                    </DialogDescription>
                </DialogHeader>
                {isCropping ? (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Preview & Align</Label>
                            <div className="relative h-64 w-full overflow-hidden rounded-md border bg-muted">
                                {selectedImageSrc ? (
                                    <Cropper
                                        image={selectedImageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                                    />
                                ) : null}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="avatar_zoom">Zoom</Label>
                                <input
                                    id="avatar_zoom"
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsCropping(false);
                                        if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
                                        setSelectedImageSrc(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="button" onClick={onConfirmCrop}>
                                    Use photo
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form action={onSubmit} className="grid gap-4 py-4">
                        <input ref={fileInputRef} type="file" name="avatar_file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) beginCropFromFile(file);
                        }} />
                        <input type="hidden" name="remove_avatar" value={removeAvatar ? "1" : ""} />
                        <input type="hidden" name="tech_stack" value={selectedLanguages.join(",")} />

                        <div className="grid gap-2">
                            <Label>Profile Photo</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="size-16">
                                    <AvatarImage src={effectiveAvatarUrl || undefined} alt={profile.username} />
                                    <AvatarFallback>
                                        <img src="/nopfp.webp" alt="Avatar" className="object-cover w-full h-full" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid gap-2">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={
                                            "rounded-md border border-dashed p-3 text-sm text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
                                            (isDragActive ? "bg-accent" : "")
                                        }
                                        onClick={onPickPhotoClick}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") onPickPhotoClick();
                                        }}
                                        onDragEnter={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragActive(true);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragActive(true);
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDragActive(false);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) beginCropFromFile(file);
                                            setIsDragActive(false);
                                        }}
                                    >
                                        Drag & drop an image here, or click to upload
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={onPickPhotoClick}>
                                            Upload photo
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!effectiveAvatarUrl}
                                            onClick={onRemovePhoto}
                                        >
                                            Remove photo
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="display_name">Display Name</Label>
                            <Input id="display_name" name="display_name" defaultValue={profile.display_name || ""} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bio">Bio</Label>
                            <Textarea id="bio" name="bio" defaultValue={profile.bio || ""} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Programming Languages</Label>
                            <div className="flex flex-wrap gap-2">
                                {LANGUAGE_OPTIONS.map((language) => {
                                    const selected = selectedLanguages.includes(language);
                                    return (
                                        <Button
                                            key={language}
                                            type="button"
                                            variant={selected ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleLanguage(language)}
                                            className="h-8 rounded-full px-3 gap-1.5"
                                        >
                                            {LANGUAGE_ICONS[language] && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={LANGUAGE_ICONS[language]} alt="" className="w-4 h-4 object-contain" />
                                            )}
                                            {language}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={customLanguage}
                                    onChange={(e) => setCustomLanguage(e.target.value)}
                                    placeholder="Add custom language"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addCustomLanguage();
                                        }
                                    }}
                                />
                                <Button type="button" variant="outline" onClick={addCustomLanguage}>
                                    Add
                                </Button>
                            </div>
                            {selectedLanguages.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedLanguages.map((language) => (
                                        <button
                                            key={language}
                                            type="button"
                                            onClick={() => toggleLanguage(language)}
                                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs bg-secondary text-secondary-foreground"
                                            title="Click to remove"
                                        >
                                            {LANGUAGE_ICONS[language] && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={LANGUAGE_ICONS[language]} alt="" className="w-3.5 h-3.5 object-contain" />
                                            )}
                                            {language}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex justify-between items-center mt-4">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" disabled={isDeleting}>
                                        {isDeleting ? "Deleting..." : "Delete Account"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-3" asChild>
                                            <div className="text-sm text-muted-foreground w-full">
                                                <p>This action cannot be undone. This will permanently delete your account and remove your data from our servers. The following will be completely wiped:</p>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li>Your profile and username</li>
                                                    <li>All of your posts (loops)</li>
                                                    <li>Your uploaded images and avatars</li>
                                                    <li>All comments and likes</li>
                                                    <li>Your direct messages and chat history</li>
                                                    <li>Who you follow and your followers</li>
                                                </ul>
                                                <div className="mt-4 pt-2">
                                                    <p className="mb-2 text-foreground">Type <span className="font-bold">delete</span> to confirm:</p>
                                                    <Input
                                                        value={deleteConfirmText}
                                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                        placeholder=""
                                                    />
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(e) => {
                                                if (deleteConfirmText !== "delete") {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                handleDeleteAccount();
                                            }}
                                            disabled={deleteConfirmText !== "delete"}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Yes, delete my account
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Saving..." : "Save changes"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
