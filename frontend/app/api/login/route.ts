import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const body = await req.json();
	const { account, password, captcha, cdigest } = body;

	let formattedAccount = account;
	if (formattedAccount && !formattedAccount.includes("@")) {
		formattedAccount = `${formattedAccount}@srmist.edu.in`;
	}

	const backendUrl = process.env.RATIO_BACKEND_URL || "http://localhost:8080";
	const res = await fetch(`${backendUrl}/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: formattedAccount,
			password,
			captcha,
			cdigest,
		}),
	});

	const data = await res.json();

	if (res.status === 401) {
		const detail = data.detail;
		if (typeof detail === "object" && detail?.type === "CAPTCHA_REQUIRED") {
			return NextResponse.json({
				authenticated: false,
				captcha: {
					image: detail.image,
					cdigest: detail.cdigest,
				},
				message: detail.message,
			});
		}
		return NextResponse.json({
			authenticated: false,
			message: typeof detail === "string" ? detail : "Invalid Credentials",
		});
	}

	if (!res.ok || !data.success) {
		return NextResponse.json({
			authenticated: false,
			message: data.detail || "Login failed",
		});
	}

	const cookiesDict = data.cookies || {};
	const cookiesStr = Object.entries(cookiesDict)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");

	return NextResponse.json({
		authenticated: true,
		cookies: cookiesStr,
	});
}
