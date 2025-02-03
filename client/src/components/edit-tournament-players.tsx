import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import PlayerSelect from "./player-select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const formSchema = z.object({
  playerIds: z.array(z.number()).min(4, "At least 4 players are required"),
});

type EditTournamentPlayersProps = {
  tournamentId: number;
  currentPlayers: Array<{
    playerId: number;
    player: { id: number; name: string };
  }>;
  onSuccess?: () => void;
};

export default function EditTournamentPlayers({ 
  tournamentId, 
  currentPlayers,
  onSuccess 
}: EditTournamentPlayersProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      playerIds: currentPlayers.map(p => p.playerId),
    },
  });

  const updatePlayers = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      await apiRequest("PATCH", `/api/tournaments/${tournamentId}/players`, {
        playerIds: values.playerIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      onSuccess?.();
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => updatePlayers.mutate(data))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="playerIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Players (minimum 4)</FormLabel>
              <FormControl>
                <PlayerSelect
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={updatePlayers.isPending}
        >
          Update Players
        </Button>
      </form>
    </Form>
  );
}
