"use node";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const args = { bookingCode: v.string(), email: v.string() };

interface TicketData {
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  movieTitle: string;
  posterUrl: string | null;
  date: string;
  time: string;
  seats: string[];
}

export const getQrDataUrl = action({
  args,
  handler: async (ctx, values): Promise<string> => {
    const ticket: TicketData | null = await ctx.runQuery(internal.bookings.getTicketData, values);
    if (!ticket) throw new Error("Confirmed ticket not found.");
    return await QRCode.toDataURL(ticket.bookingCode, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 480,
      color: { dark: "#05070d", light: "#ffffff" },
    });
  },
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

export const getPdfBase64 = action({
  args,
  handler: async (ctx, values): Promise<string> => {
    const ticket: TicketData | null = await ctx.runQuery(internal.bookings.getTicketData, values);
    if (!ticket) throw new Error("Confirmed ticket not found.");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([420, 720]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const white = rgb(0.96, 0.97, 1);
    const muted = rgb(0.48, 0.57, 0.72);
    const purple = rgb(0.48, 0.2, 0.84);
    page.drawRectangle({ x: 0, y: 0, width: 420, height: 720, color: rgb(0.025, 0.035, 0.065) });
    page.drawText("ARAVALLI", { x: 30, y: 674, size: 17, font: bold, color: white });
    page.drawText("AUDITORIUM", { x: 30, y: 657, size: 10, font: bold, color: muted });
    page.drawText("BOOKING ID", { x: 298, y: 674, size: 9, font: bold, color: muted });
    page.drawText(ticket.bookingCode, { x: 298, y: 657, size: 8, font: bold, color: white });

    let posterBottom = 390;
    if (ticket.posterUrl) {
      try {
        const response = await fetch(ticket.posterUrl);
        if (response.ok) {
          const bytes = await response.arrayBuffer();
          const type = response.headers.get("content-type") ?? "";
          const image = type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          page.drawImage(image, { x: 30, y: posterBottom, width: 360, height: 230 });
        }
      } catch {
        page.drawRectangle({ x: 30, y: posterBottom, width: 360, height: 230, color: rgb(0.07, 0.1, 0.16) });
      }
    }
    page.drawText(ticket.movieTitle.slice(0, 42), { x: 30, y: 360, size: 20, font: bold, color: white });

    const fields = [
      ["Date", formatDate(ticket.date), 30, 322],
      ["Time", formatTime(ticket.time), 224, 322],
      ["Screen", "Screen 1", 30, 280],
      ["Seats", ticket.seats.join(", "), 224, 280],
    ] as const;
    for (const [label, value, x, y] of fields) {
      page.drawText(label, { x, y, size: 9, font: regular, color: muted });
      page.drawText(value, { x, y: y - 17, size: 12, font: bold, color: white });
    }

    const qrData = await QRCode.toDataURL(ticket.bookingCode, { errorCorrectionLevel: "H", margin: 1, width: 400 });
    const qr = await pdf.embedPng(qrData);
    page.drawRectangle({ x: 150, y: 110, width: 120, height: 120, color: rgb(1, 1, 1) });
    page.drawImage(qr, { x: 156, y: 116, width: 108, height: 108 });
    page.drawText("Scan this QR at the entrance", { x: 135, y: 92, size: 9, font: regular, color: muted });
    page.drawText("Total paid", { x: 30, y: 58, size: 9, font: regular, color: muted });
    page.drawText(`INR ${ticket.totalAmount.toFixed(2)}`, { x: 310, y: 55, size: 13, font: bold, color: white });
    page.drawRectangle({ x: 30, y: 35, width: 360, height: 1, color: purple });
    page.drawText("Thank you! Enjoy the show", { x: 139, y: 17, size: 9, font: regular, color: muted });

    const bytes = await pdf.save();
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  },
});
