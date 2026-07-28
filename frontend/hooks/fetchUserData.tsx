"use server";
import { cache } from "react";
import type { AllResponse } from "@/types/Response";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const dataCache: Map<string, { data: AllResponse; timestamp: number }> =
	new Map();

async function fetchData(): Promise<AllResponse> {
	const cookieStore = await cookies();
	const key = cookieStore.get("key")?.value;
	if (!key) {
		return {
			user: undefined,
			attendance: [],
			marks: { regNumber: "", marks: [], status: 401 },
			courses: [],
			timetable: { regNumber: "", batch: "1", schedule: [] },
			lastUpdated: 0,
			token: "",
			status: 401,
			regNumber: "",
		} as unknown as AllResponse;
	}

	const userKey = `key-${key}`;
	const cachedData = dataCache.get(userKey);
	const now = Date.now();
	if (cachedData && now - cachedData.timestamp < 5 * 60 * 1000) {
		return cachedData.data;
	}

	const cookiesDict: Record<string, string> = {};
	for (const part of key.split(";")) {
		if (part.includes("=")) {
			const [k, v] = part.split("=", 2);
			cookiesDict[k.trim()] = v.trim();
		}
	}

	const backendUrl = process.env.RATIO_BACKEND_URL || "http://localhost:8080";
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
		redirect("/sleeping");
	}, 10000);

	try {
		const response = await fetch(`${backendUrl}/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "dummy",
				cookies: cookiesDict,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			redirect("/invalid");
		}

		const data = await response.json();
		if (!data.success) {
			redirect("/invalid");
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
			combo: "",
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

		const attendanceList = (data.attendance || []).map((item: any) => {
			let faculty = "Unknown";
			let room = "Unknown";
			const slot = item.slot;
			if (coursesDict[slot]) {
				faculty = coursesDict[slot].faculty || "Unknown";
				room = coursesDict[slot].room || "Unknown";
			} else {
				for (const slotKey in coursesDict) {
					if (coursesDict[slotKey].code === item.code) {
						faculty = coursesDict[slotKey].faculty || "Unknown";
						room = coursesDict[slotKey].room || "Unknown";
						break;
					}
				}
			}
			return {
				courseCode: item.code,
				courseTitle: item.title,
				category: item.category,
				facultyName: faculty,
				slot: item.slot,
				hoursConducted: String(item.conducted),
				hoursAbsent: String(item.absent),
				attendancePercentage: String(item.percent),
			};
		});

		const marksList = (data.marks || []).map((item: any) => {
			let courseName = item.courseCode;
			for (const slotKey in coursesDict) {
				if (coursesDict[slotKey].code === item.courseCode) {
					courseName = coursesDict[slotKey].name;
					break;
				}
			}
			const testPerformance = (item.assessments || []).map((ass: any) => ({
				test: ass.title,
				marks: {
					scored: ass.marks,
					total: ass.total,
				},
			}));
			return {
				courseName,
				courseCode: item.courseCode,
				courseType: item.type,
				overall: {
					scored:
						item.totalMarkGot !== null && item.totalMarkGot !== undefined
							? String(item.totalMarkGot)
							: "0",
					total:
						item.totalMaxMarks !== null && item.totalMaxMarks !== undefined
							? String(item.totalMaxMarks)
							: "0",
				},
				testPerformance,
			};
		});

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

		const timetableResult = {
			regNumber: user_info.regNumber,
			batch: actualBatch,
			schedule: schedule,
		};

		const ophoursCookie = cookieStore.get("ophours")?.value;

		const jsonResult: AllResponse = {
			user: user_info,
			attendance: {
				attendance: attendanceList,
				regNumber: user_info.regNumber,
				status: 200,
			},
			marks: {
				regNumber: user_info.regNumber,
				marks: marksList,
				status: 200,
			},
			courses: {
				courses: coursesList,
				regNumber: user_info.regNumber,
			},
			timetable: timetableResult,
			lastUpdated: Date.now(),
			token: key,
			status: 200,
			regNumber: user_info.regNumber,
		};

		if (ophoursCookie) {
			jsonResult.ophour = ophoursCookie;
		}

		dataCache.set(userKey, {
			data: jsonResult,
			timestamp: now,
		});

		if (dataCache.size > 50) {
			const oldEntries = Array.from(dataCache.entries()).filter(
				([_, value]) => now - value.timestamp > 10 * 60 * 1000,
			);
			for (const [k] of oldEntries) {
				dataCache.delete(k);
			}
		}

		return jsonResult;
	} catch (error) {
		if ((error as Error).name === "AbortError") {
			redirect("/sleeping");
		}
		throw error;
	}
}

export const fetchUserData = cache(async () => {
	return await fetchData();
});
