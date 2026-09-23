import { cn } from "@/lib/utils";

interface ContributionGraphProps {
    data?: { date: string; count: number }[];
}

function seededRandom01(seed: number) {
    let x = seed >>> 0;
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
}

export function ContributionGraph({ data }: ContributionGraphProps) {
    void data;

    const days: number[] = [];
    for (let index = 0; index < 365; index += 1) {
        const rand = seededRandom01(index + 1);
        let intensity = 0;
        if (rand > 0.9) intensity = 4;
        else if (rand > 0.8) intensity = 3;
        else if (rand > 0.7) intensity = 2;
        else if (rand > 0.5) intensity = 1;
        days.push(intensity);
    }

    return (
        <div className="p-6 border-b">
            <h3 className="font-semibold mb-4">Contributions</h3>
            <div className="overflow-x-auto pb-2">
                <div className="grid grid-rows-7 grid-flow-col gap-1 w-fit">
                    {days.map((intensity, index) => (
                        <div
                            key={index}
                            className={cn(
                                "w-3 h-3 rounded-sm",
                                intensity === 0 && "bg-secondary/50",
                                intensity === 1 && "bg-emerald-200 dark:bg-emerald-900",
                                intensity === 2 && "bg-emerald-400 dark:bg-emerald-700",
                                intensity === 3 && "bg-emerald-600 dark:bg-emerald-500",
                                intensity === 4 && "bg-emerald-800 dark:bg-emerald-300",
                            )}
                        />
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 justify-end">
                <span>Less</span>
                <div className="w-3 h-3 bg-secondary/50 rounded-sm" />
                <div className="w-3 h-3 bg-emerald-200 dark:bg-emerald-900 rounded-sm" />
                <div className="w-3 h-3 bg-emerald-400 dark:bg-emerald-700 rounded-sm" />
                <div className="w-3 h-3 bg-emerald-600 dark:bg-emerald-500 rounded-sm" />
                <div className="w-3 h-3 bg-emerald-800 dark:bg-emerald-300 rounded-sm" />
                <span>More</span>
            </div>
        </div>
    );
}
