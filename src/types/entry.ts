export type LocationId = "main" | "other" | "meeting" | "remote";

export interface Entry {
  id: string;
  start: string;
  end: string | null;
  location: LocationId;
  note: string;
}

export const LOCATIONS: { id: LocationId; label: string }[] = [
  { id: "main", label: "Main office" },
  { id: "other", label: "Other office" },
  { id: "meeting", label: "Meeting" },
  { id: "remote", label: "Remote" },
];

export function locLabel(id: string): string {
  return LOCATIONS.find((l) => l.id === id)?.label ?? id;
}
