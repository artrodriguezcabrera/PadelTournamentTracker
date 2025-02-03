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
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pointSystem: z.enum(["16", "24", "32"]),
  courts: z.string().transform((val) => parseInt(val)),
});

type Tournament = {
  id: number;
  name: string;
  pointSystem: number;
  courts: number;
};

type TournamentFormProps = {
  tournament?: Tournament;
  onSuccess?: () => void;
};

export default function TournamentForm({ tournament, onSuccess }: TournamentFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tournament?.name || "",
      pointSystem: tournament?.pointSystem.toString() as "16" | "24" | "32" || "16",
      courts: tournament?.courts.toString() || "1",
    },
  });

  const tournamentMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (tournament) {
        await apiRequest("PATCH", `/api/tournaments/${tournament.id}`, {
          ...values,
          pointSystem: parseInt(values.pointSystem),
        });
      } else {
        await apiRequest("POST", "/api/tournaments", {
          ...values,
          pointSystem: parseInt(values.pointSystem),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      onSuccess?.();
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => tournamentMutation.mutate(data))}
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
          name="courts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Courts</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select courts" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">1 Court</SelectItem>
                  <SelectItem value="2">2 Courts</SelectItem>
                  <SelectItem value="3">3 Courts</SelectItem>
                  <SelectItem value="4">4 Courts</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={tournamentMutation.isPending}
        >
          {tournament ? "Update Tournament" : "Create Tournament"}
        </Button>
      </form>
    </Form>
  );
}