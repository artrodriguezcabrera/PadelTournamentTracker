import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
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

  const createPlayer = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/players", { name });
      const newPlayer: Player = await response.json();
      return newPlayer;
    },
    onSuccess: (newPlayer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      onChange([...value, newPlayer.id]);
      setNewPlayerName("");
      setIsAddingPlayer(false);
    },
  });

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
            <DialogDescription>
              Enter the player's name to add them to the system.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPlayerName.trim()) {
                createPlayer.mutate(newPlayerName.trim());
              }
            }}
            className="flex gap-2"
          >
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Player name"
              disabled={createPlayer.isPending}
            />
            <Button 
              type="submit"
              disabled={createPlayer.isPending || !newPlayerName.trim()}
            >
              Add
            </Button>
          </form>
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