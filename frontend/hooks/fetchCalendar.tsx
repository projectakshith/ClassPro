"use server";
import type { CalendarResponse, Day, Calendar } from "@/types/Calendar";
import { cache } from "react";
import calendarData from "../misc/calendar_data.json";

function getCalendarFromLocal(): CalendarResponse {
	const now = new Date();
	const tomorrowDate = new Date(now);
	tomorrowDate.setDate(now.getDate() + 1);

	const formatDate = (d: Date) => {
		const day = String(d.getDate()).padStart(2, "0");
		const month = d.toLocaleString("en-US", { month: "short" });
		const year = d.getFullYear();
		return `${day} ${month} ${year}`;
	};

	const todayStr = formatDate(now);
	const tomorrowStr = formatDate(tomorrowDate);

	const todayItem = calendarData.find((item) => item.date === todayStr);
	const tomorrowItem = calendarData.find((item) => item.date === tomorrowStr);

	const today: Day = {
		date: String(now.getDate()),
		day: now.toLocaleString("en-US", { weekday: "short" }),
		event:
			todayItem?.description && todayItem.description !== "-"
				? todayItem.description
				: undefined,
		dayOrder: todayItem?.order || "-",
	};

	const tomorrow: Day = {
		date: String(tomorrowDate.getDate()),
		day: tomorrowDate.toLocaleString("en-US", { weekday: "short" }),
		event:
			tomorrowItem?.description && tomorrowItem.description !== "-"
				? tomorrowItem.description
				: undefined,
		dayOrder: tomorrowItem?.order || "-",
	};

	const grouped: Record<string, Day[]> = {};
	const monthKeys: string[] = [];

	for (const item of calendarData) {
		const parts = item.date.split(" ");
		if (parts.length < 3) continue;
		const dateNum = String(Number.parseInt(parts[0]));
		const monthShort = parts[1];
		const yearShort = parts[2].slice(-2);
		const monthLabel = `${monthShort} '${yearShort}`;

		if (!grouped[monthLabel]) {
			grouped[monthLabel] = [];
			monthKeys.push(monthLabel);
		}

		grouped[monthLabel].push({
			date: dateNum,
			day: item.day,
			event:
				item.description && item.description !== "-"
					? item.description
					: undefined,
			dayOrder: item.order || "-",
		});
	}

	const calendarList: Calendar[] = [];
	for (const key of monthKeys) {
		calendarList.push({
			month: key,
			days: grouped[key],
		});
	}

	return {
		today,
		tomorrow,
		index: 0,
		calendar: calendarList,
		requestedAt: Date.now(),
		logout: false,
		error: false,
		message: "",
		status: 200,
	};
}

async function fetchCal() {
	return getCalendarFromLocal();
}

export const fetchCalendar = cache(fetchCal);
