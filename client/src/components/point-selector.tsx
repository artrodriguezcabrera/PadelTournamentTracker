import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PointSelectorProps = {
  maxPoints: number;
  value: string;
  onChange: (points: number) => void;
  disabled?: boolean;
};

export default function PointSelector({
  maxPoints,
  value,
  onChange,
  disabled,
}: PointSelectorProps) {
  const points = Array.from({ length: maxPoints + 1 }, (_, i) => i);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-20"
          disabled={disabled}
        >
          {value || 'Score'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-4 gap-2">
          {points.map((point) => (
            <Button
              key={point}
              variant="outline"
              className={cn(
                "h-10 w-full",
                parseInt(value) === point && "bg-primary text-primary-foreground"
              )}
              onClick={() => onChange(point)}
            >
              {point}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}