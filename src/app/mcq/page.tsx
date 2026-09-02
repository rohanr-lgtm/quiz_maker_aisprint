import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMcqs } from "@/lib/services/mcq-service";
import { LogoutButton } from "@/app/mcq/logout-button";
import { McqRowActions } from "@/app/mcq/mcq-row-actions";

export default async function McqPage() {
  const mcqs = await listMcqs();

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Question Bank</h1>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/mcq/new" />}>Create Question</Button>
          <LogoutButton />
        </div>
      </div>

      {mcqs.length === 0 ? (
        <p className="text-muted-foreground">
          No questions yet — create your first one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mcqs.map((mcq) => (
              <TableRow key={mcq.id}>
                <TableCell className="font-medium">{mcq.name}</TableCell>
                <TableCell className="max-w-md truncate">
                  {mcq.question}
                </TableCell>
                <TableCell>
                  <McqRowActions mcqId={mcq.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
