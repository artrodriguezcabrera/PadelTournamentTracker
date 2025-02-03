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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { type Player } from "@db/schema";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type AddEditPlayerFormProps = {
  player?: Player;
  onSuccess?: () => void;
};

export default function AddEditPlayerForm({ player, onSuccess }: AddEditPlayerFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: player?.name || "",
    },
  });

  const playerMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (player) {
        await apiRequest("PATCH", `/api/players/${player.id}`, values);
      } else {
        await apiRequest("POST", "/api/players", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      onSuccess?.();
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => playerMutation.mutate(data))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Player Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={playerMutation.isPending}
        >
          {player ? "Update Player" : "Add Player"}
        </Button>
      </form>
    </Form>
  );
}
