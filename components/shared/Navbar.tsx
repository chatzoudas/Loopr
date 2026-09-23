import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LeftSidebar } from "./LeftSidebar"

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden">
            <div className="container flex h-14 items-center px-4">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="mr-2 h-11 w-11">
                            <Menu className="h-6 w-6" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64">
                        <LeftSidebar className="h-full border-0" />
                    </SheetContent>
                </Sheet>

                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <span className="text-primary">Loopr</span>
                </Link>
            </div>
        </header>
    )
}
