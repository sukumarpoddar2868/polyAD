"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import type { Cover, Polygons } from "./cover";
import { searchSeats, type SeatSummary } from "./search";
import { getSeat, seatCover, seatSummaries } from "./seats";

export type SeatShape = { no: number; polygons: Polygons; bbox: [number, number, number, number]; cover: Cover };

const Input = z.object({ no: z.number().int().min(1).max(403), maxCircles: z.number().int().min(1).max(200).optional() });

/** Boundary + Meta covering circles for one seat. */
export async function seatShapeAction(input: { no: number; maxCircles?: number }): Promise<SeatShape | null> {
  await requireUser();
  const p = Input.safeParse(input);
  if (!p.success) return null;
  const seat = getSeat(p.data.no);
  const cover = seatCover(p.data.no, p.data.maxCircles);
  if (!seat || !cover) return null;
  return { no: seat.no, polygons: seat.polygons, bbox: seat.bbox, cover };
}

/** Seat search for the campaign wizard (summaries only, no geometry). */
export async function findSeatsAction(q: string): Promise<SeatSummary[]> {
  await requireUser();
  return searchSeats(seatSummaries(), String(q).slice(0, 60), 8);
}
