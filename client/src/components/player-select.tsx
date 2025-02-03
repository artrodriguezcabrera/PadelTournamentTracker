import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, PlusCircle, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { type Player } from "@db/schema";

type PlayerSelectProps = {
  value: number[];
  onChange: (value: number[]) => void;
};

export default function PlayerSelect({ value, onChange }: PlayerSelectProps) {
  const [open, setOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const selectedPlayers = players.filter((player) => value.includes(player.id));

  const addNewPlayer = async () => {
    if (!newPlayerName.trim()) return;

    try {
      const response = await apiRequest("POST", "/api/players", {
        name: newPlayerName.trim(),
      });
      const newPlayer: Player = await response.json();
      onChange([...value, newPlayer.id]);
      setNewPlayerName("");
      setIsAddingPlayer(false);
    } catch (error) {
      console.error("Failed to add player:", error);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between"
          >
            <span>
              {selectedPlayers.length === 0
                ? "Select players"
                : `${selectedPlayers.length} players selected`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search players..." />
            <CommandEmpty>No players found.</CommandEmpty>
            <CommandGroup>
              {players.map((player) => (
                <CommandItem
                  key={player.id}
                  onSelect={() => {
                    onChange(
                      value.includes(player.id)
                        ? value.filter((id) => id !== player.id)
                        : [...value, player.id]
                    );
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(player.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <UserCircle className="mr-2 h-4 w-4" />
                  {player.name}
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setIsAddingPlayer(true);
                  setOpen(false);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add new player
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={isAddingPlayer} onOpenChange={setIsAddingPlayer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Player</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
            />
            <Button onClick={addNewPlayer}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedPlayers.map((player) => (
            <div
              key={player.id}
              className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm"
            >
              {player.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}