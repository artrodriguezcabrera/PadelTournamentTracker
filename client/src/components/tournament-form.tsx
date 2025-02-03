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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import PlayerSelect from "./player-select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pointSystem: z.enum(["16", "24", "32"]),
  playerIds: z.array(z.number()).min(4, "At least 4 players are required"),
});

type TournamentFormProps = {
  onSuccess?: () => void;
};

export default function TournamentForm({ onSuccess }: TournamentFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pointSystem: "16",
      playerIds: [],
    },
  });

  const createTournament = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      await apiRequest("POST", "/api/tournaments", {
        ...values,
        pointSystem: parseInt(values.pointSystem),
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
        onSubmit={form.handleSubmit((data) => createTournament.mutate(data))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tournament Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pointSystem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Point System</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select points" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="16">16 Points</SelectItem>
                  <SelectItem value="24">24 Points</SelectItem>
                  <SelectItem value="32">32 Points</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="playerIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Players</FormLabel>
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
          disabled={createTournament.isPending}
        >
          Create Tournament
        </Button>
      </form>
    </Form>
  );
}
