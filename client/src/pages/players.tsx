import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit, Trash2, ArrowLeft } from "lucide-react";
import AddEditPlayerForm from "@/components/add-edit-player-form";
import { type Player } from "@db/schema";

export default function Players() {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const { data: players } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <div className="flex-1 flex justify-between items-center">
            <h1 className="text-4xl font-bold">Players</h1>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </DialogTrigger>
              <DialogContent>
                <AddEditPlayerForm
                  onSuccess={() => {
                    setIsAddOpen(false);
                    toast({
                      title: "Player added",
                      description: "The player has been added successfully.",
                    });
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players?.map((player) => (
            <Card key={player.id}>
              <CardHeader className="pb-4">
                <CardTitle>{player.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2">
                  <Dialog
                    open={editingPlayer?.id === player.id}
                    onOpenChange={(open) =>
                      setEditingPlayer(open ? player : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <AddEditPlayerForm
                        player={player}
                        onSuccess={() => {
                          setEditingPlayer(null);
                          toast({
                            title: "Player updated",
                            description: "The player has been updated successfully.",
                          });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (confirm("Are you sure you want to delete this player?")) {
                        try {
                          await fetch(`/api/players/${player.id}`, {
                            method: "DELETE",
                          });
                          toast({
                            title: "Player deleted",
                            description: "The player has been deleted successfully.",
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to delete the player.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}