import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgentDefinition, AgentStatus } from '@/types/agentRegistry';
import { ZONE_OPTIONS } from '@/types/agentRegistry';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';

function toKebab(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const schema = z.object({
  name: z.string().min(3, 'Min 3 characters'),
  id: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be kebab-case'),
  zone: z.string().min(1, 'Required'),
  order: z.coerce.number().int().positive(),
  status: z.enum(['active', 'inactive', 'draft'] as const),
  description: z.string().optional(),
  behavior: z.string().min(20, 'Min 20 characters'),
});

type FormValues = z.infer<typeof schema>;

interface AgentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentDefinition | null;
  existingIds: string[];
  nextOrder: number;
  onSave: (agent: AgentDefinition) => void;
}

export function AgentForm({ open, onOpenChange, agent, existingIds, nextOrder, onSave }: AgentFormProps) {
  const isEdit = !!agent;
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(
      schema.refine(
        (data) => isEdit || !existingIds.includes(data.id),
        { message: 'ID already exists', path: ['id'] }
      )
    ),
    defaultValues: {
      name: '',
      id: '',
      zone: '',
      order: nextOrder,
      status: 'draft' as AgentStatus,
      description: '',
      behavior: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (agent) {
        form.reset({
          name: agent.name,
          id: agent.id,
          zone: agent.zone,
          order: agent.order,
          status: agent.status,
          description: agent.description || '',
          behavior: agent.behavior,
        });
      } else {
        form.reset({
          name: '', id: '', zone: '', order: nextOrder,
          status: 'draft', description: '', behavior: '',
        });
      }
    }
  }, [open, agent, nextOrder, form]);

  // Auto-generate id from name
  const nameValue = form.watch('name');
  useEffect(() => {
    if (!isEdit && nameValue) {
      form.setValue('id', toKebab(nameValue), { shouldValidate: false });
    }
  }, [nameValue, isEdit, form]);

  const onSubmit = (values: FormValues) => {
    const def: AgentDefinition = {
      id: values.id,
      name: values.name,
      zone: values.zone,
      order: values.order,
      status: values.status,
      behavior: values.behavior,
      description: values.description || undefined,
      triggers: agent?.triggers || [],
      created: agent?.created || today,
      updated: today,
    };
    onSave(def);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Agent' : 'New Agent'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update agent definition' : 'Declare a new execution agent'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Architecture Guardian" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="id" render={({ field }) => (
              <FormItem>
                <FormLabel>ID <span className="text-muted-foreground text-xs">(kebab-case)</span></FormLabel>
                <FormControl><Input placeholder="architecture-guardian" {...field} disabled={isEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="zone" render={({ field }) => (
              <FormItem>
                <FormLabel>Zone</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ZONE_OPTIONS.map(z => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Input placeholder="Short one-liner..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="behavior" render={({ field }) => (
              <FormItem>
                <FormLabel>Behavior (pseudocode)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={"ON new_note IN zone:\n  READ existing notes\n  CHECK consistency\n  IF gap FOUND:\n    CREATE proposal"}
                    className="font-mono text-sm min-h-[240px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{isEdit ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
