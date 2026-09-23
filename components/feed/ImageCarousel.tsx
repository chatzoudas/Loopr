
"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ImageCarousel({ images, noMargin }: { images: string[], noMargin?: boolean }) {
    const [currentIndex, setCurrentIndex] = useState(0)

    if (!images || images.length === 0) return null

    if (images.length === 1) {
        return (
            <img
                src={images[0]}
                alt="Post image"
                className={`max-h-[520px] w-full ${noMargin ? "" : "rounded-md"} object-cover md:object-contain ${noMargin ? "" : "mt-3"} select-none`}
                loading="lazy"
            />
        )
    }

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
        <div className={`relative group ${noMargin ? "" : "mt-3"}`} onClick={(e) => e.stopPropagation()}>
            <img
                src={images[currentIndex]}
                alt={`Post image ${currentIndex + 1}`}
                className={`max-h-[520px] w-full ${noMargin ? "" : "rounded-md"} object-contain select-none`}
                loading="lazy"
            />

            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1 z-10">
                {images.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-primary/50"
                            }`}
                    />
                ))}
            </div>

            <Button
                variant="secondary"
                size="icon"
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full z-10"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
                variant="secondary"
                size="icon"
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full z-10"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

