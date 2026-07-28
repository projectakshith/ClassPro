import type { Schedule, ScheduleSlot } from "@/types/Timetable";
import { ImageResponse } from "next/og";
import { Time, timeConvert } from "@/utils/Times";
import { cookies } from "next/headers";

export async function GET() {
	const cookieStore = await cookies();
	const key = cookieStore.get("key")?.value;

	if (!key) {
		return new Response("Unauthorized", { status: 401 });
	}

	const cookiesDict: Record<string, string> = {};
	for (const part of key.split(";")) {
		if (part.includes("=")) {
			const [k, v] = part.split("=", 2);
			cookiesDict[k.trim()] = v.trim();
		}
	}

	const backendUrl = process.env.RATIO_BACKEND_URL || "http://localhost:8080";
	const res = await fetch(`${backendUrl}/refresh`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: "dummy",
			cookies: cookiesDict,
		}),
	});

	if (!res.ok) {
		return new Response("Failed to load data", { status: 500 });
	}

	const data = await res.json();
	if (!data.success) {
		return new Response("Failed to load data", { status: 500 });
	}

	const profile = data.profile || {};
	const semesterVal = Number.parseInt(profile.semester) || 0;
	const yearVal = semesterVal > 0 ? Math.floor((semesterVal + 1) / 2) : 0;
	const user_info = {
		name: profile.name || "",
		mobile: profile.mobile || "",
		program: profile.program || "",
		semester: semesterVal,
		regNumber: profile.regNo || "",
		batch: profile.batch || "1",
		year: yearVal,
		department: profile.dept || "",
		section: profile.section || "",
		specialization: "",
	};

	const coursesDict = data.courses || {};
	const coursesList: any[] = [];
	const seenCodes = new Set<string>();
	for (const slotKey in coursesDict) {
		const details = coursesDict[slotKey];
		const code = details.code;
		if (code && !seenCodes.has(code)) {
			seenCodes.add(code);
			coursesList.push({
				code: code,
				title: details.name,
				credit: details.credits,
				category: details.type,
				courseCategory: details.raw_type || "",
				type: details.type,
				slotType: details.type,
				faculty: details.faculty,
				slot: details.slot,
				room: details.room,
				academicYear: "2025-26",
			});
		}
	}

	const actualBatch = user_info.batch;
	const batch1_slots = [
		{ day: 1, slots: ["A", "A", "F", "F", "G", "P6", "P7", "P8", "P9", "P10"] },
		{ day: 2, slots: ["P11", "P12", "P13", "P14", "P15", "B", "B", "G", "G", "A"] },
		{ day: 3, slots: ["C", "C", "A", "D", "B", "P26", "P27", "P28", "P29", "P30"] },
		{ day: 4, slots: ["P31", "P32", "P33", "P34", "P35", "D", "D", "B", "E", "C"] },
		{ day: 5, slots: ["E", "E", "C", "F", "D", "P46", "P47", "P48", "P49", "P50"] },
	];
	const batch2_slots = [
		{ day: 1, slots: ["P1", "P2", "P3", "P4", "P5", "A", "A", "F", "F", "G"] },
		{ day: 2, slots: ["B", "B", "G", "G", "A", "P16", "P17", "P18", "P19", "P20"] },
		{ day: 3, slots: ["P21", "P22", "P23", "P24", "P25", "C", "C", "A", "D", "B"] },
		{ day: 4, slots: ["D", "D", "B", "E", "C", "P36", "P37", "P38", "P39", "P40"] },
		{ day: 5, slots: ["P41", "P42", "P43", "P44", "P45", "E", "E", "C", "F", "D"] },
	];

	const slotMapping: Record<string, any[]> = {};
	for (const slotKey in coursesDict) {
		const courseInfo = coursesDict[slotKey];
		const isOnline = courseInfo.room.toLowerCase().includes("online");
		const slotType = isOnline ? "Practical" : courseInfo.type;
		const tableSlot = {
			code: courseInfo.code,
			name: courseInfo.name,
			online: isOnline,
			courseType: slotType,
			roomNo: courseInfo.room,
			slot: slotKey,
			isOptional: false,
		};
		if (!slotMapping[slotKey]) {
			slotMapping[slotKey] = [];
		}
		slotMapping[slotKey].push(tableSlot);
	}

	const batchSlots = actualBatch === "2" ? batch2_slots : batch1_slots;
	const schedule = [];
	for (const dayEntry of batchSlots) {
		const dayNum = dayEntry.day;
		const slotsList = dayEntry.slots;
		const dayTable = [];
		for (const slot of slotsList) {
			if (slotMapping[slot]) {
				const slots = slotMapping[slot];
				if (slots.length > 1) {
					const merged = {
						code: Array.from(new Set(slots.map((s) => s.code))).join("/"),
						name: Array.from(new Set(slots.map((s) => s.name))).join("/"),
						online: slots[0].online,
						courseType: slots[0].courseType,
						roomNo: Array.from(new Set(slots.map((s) => s.roomNo))).join("/"),
						slot: slot,
						isOptional: false,
					};
					dayTable.push(merged);
				} else {
					dayTable.push(slots[0]);
				}
			} else {
				dayTable.push(null);
			}
		}
		schedule.push({
			day: dayNum,
			table: dayTable,
		});
	}

	const timetable = schedule as unknown as Schedule[];
	const ophoursString = cookieStore.get("ophours")?.value;
	const ophours = ophoursString?.split(",");
	if (ophours?.[0]) {
		for (const ophour of ophours) {
			const [day, hour] = ophour.split("-");
			const dayIndex = Number.parseInt(day.replace("D", "")) - 1;
			const hourIndex = Number.parseInt(hour.replace("H", "")) - 1;

			const slot = timetable[dayIndex].table[hourIndex];
			if (slot) slot.isOptional = true;
		}
	}

	const geist = await fetch(
		new URL("../../../public/fonts/Geist.ttf", import.meta.url),
	).then((res) => res.arrayBuffer());

	const response = new ImageResponse(
		<section
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				background: "#11151B",
				justifyContent: "space-around",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<TimeArr />
				<TimetableImage timetable={timetable} />
			</div>
			<p tw="text-white text-lg opacity-70 pb-2">Made with ClassPro</p>
		</section>,
		{
			width: 2400,
			height: 1000,
			fonts: [
				{
					name: "Geist",
					data: geist,
					style: "normal",
				},
			],
		},
	);

	return new Response(await response.arrayBuffer(), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
			Pragma: "no-cache",
			Expires: "0",
			Vary: "Cookie",
		},
	});
}

function TimeArr() {
	return (
		<div style={{ height: "50px" }} tw="flex flex-row justify-between w-full">
			{Time.start.map((start, index) => (
				<div
					style={{ width: "240px" }}
					tw="flex flex-col items-center justify-center"
					key={index}
				>
					<p tw="text-white text-lg opacity-70">
						{timeConvert(start)} - {timeConvert(Time.end[index])}
					</p>
				</div>
			))}
		</div>
	);
}

function TimetableImage({ timetable }: { timetable: Schedule[] }) {
	return (
		<div
			tw="flex flex-col"
			style={{ display: "flex", flexDirection: "column", height: "900px" }}
		>
			{timetable.map((item, index) => (
				<ImageGenerator timetable={item} key={index} />
			))}
		</div>
	);
}

function ImageGenerator({ timetable }: { timetable: Schedule }) {
	const theoryPosition = timetable?.table
		?.slice(0, 5)
		.some((item) => item?.courseType === "Theory")
		? 0
		: 1;
	return (
		<div tw="h-full flex flex-row" style={{ height: "180px" }}>
			<div
				tw={`${theoryPosition === 0 ? "bg-[#F2D869]" : "bg-[#69E069]"} h-full flex w-[1200px]`}
			>
				{timetable?.table?.slice(0, 5).map((item, index) => (
					<TableCell key={index} cell={item} />
				))}
			</div>
			<div
				tw={`${theoryPosition === 0 ? "bg-[#69E069]" : "bg-[#F2D869]"} h-full flex w-[1200px]`}
			>
				{timetable?.table?.slice(5, 10).map((item, index) => (
					<TableCell key={index} cell={item} />
				))}
			</div>
		</div>
	);
}

function TableCell({ cell }: { cell: ScheduleSlot | null }) {
	return (
		<div
			style={{ width: "240px" }}
			tw={`border-2 flex flex-col text-black relative justify-between items-start px-6 ${!cell ? "bg-black/70" : cell.isOptional ? "bg-black/40" : ""} border-black/60`}
		>
			<p tw="text-xl font-semibold text-left mr-3">
				{cell?.name.split(":")[0]}
			</p>
			<div tw="flex items-end justify-between w-full opacity-60 flex">
				<p tw="text-lg font-semibold">{cell?.roomNo}</p>
				{cell?.isOptional && <p tw="text-lg font-semibold">(Optional)</p>}
			</div>
		</div>
	);
}

export const runtime = "edge";
