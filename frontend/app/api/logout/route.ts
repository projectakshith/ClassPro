import { cookies } from "next/headers";

export async function DELETE() {
	const cookieStore = await cookies();
	const key = cookieStore.get("key")?.value || "";

	try {
		await fetch(
			"https://academia.srmist.edu.in/accounts/p/10002227248/logout?servicename=ZohoCreator&serviceurl=https://academia.srmist.edu.in",
			{
				method: "GET",
				headers: {
					cookie: key,
					"User-Agent": "Mozilla/5.0",
				},
			},
		);
	} catch {}

	for (const c of cookieStore.getAll()) {
		cookieStore.delete(c.name);
	}

	return Response.json({ message: "Logged out" });
}
