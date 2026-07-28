import { cookies } from "next/headers";

export async function POST(req: Request) {
	const cookieStore = await cookies();
	const body = await req.json();
	const { ophours } = body;

	if (
		!Array.isArray(ophours) ||
		!ophours.every((item) => typeof item === "string")
	) {
		return Response.json(
			{ error: "Invalid input" },
			{
				status: 400,
			},
		);
	}

	const ophoursString = ophours.join(",");
	cookieStore.set("ophours", ophoursString, { maxAge: 60 * 60 * 24 * 365, path: "/" });

	return Response.json(
		{ success: true },
		{
			status: 200,
		},
	);
}
