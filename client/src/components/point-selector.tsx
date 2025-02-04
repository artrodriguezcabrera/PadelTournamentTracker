import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
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
          className="w-20 relative overflow-hidden"
          disabled={disabled}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={value}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {value || 'Score'}
            </motion.span>
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-4 gap-2">
          {points.map((point) => (
            <motion.div
              key={point}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-full",
                  parseInt(value) === point && "bg-primary text-primary-foreground"
                )}
                onClick={() => onChange(point)}
              >
                {point}
              </Button>
            </motion.div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}