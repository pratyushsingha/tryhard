import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

async function handler(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  const headerPayload = headers();
  const svix_id = (await headerPayload).get("svix-id");
  const svix_timestamp = (await headerPayload).get("svix-timestamp");
  const svix_signature = (await headerPayload).get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return Response.json(
      { success: false, message: "Error verifying webhook" },
      {
        status: 400,
      }
    );
  }
  const eventType = evt.type;
  if (eventType === "user.created") {
    const data = evt.data;
    console.log({
      userId: data.id,
      email: data.email_addresses[0].email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      avatar: data.image_url,
    });
    await prisma.user.create({
      data: {
        userId: data.id,
        email: data.email_addresses[0].email_address,
        name: `${data.first_name} ${data.last_name}`,
        avatar: data.image_url,
      },
    });
  }
  return Response.json(
    { success: true, message: "user pushed to db" },
    { status: 200 }
  );
}

export { handler as GET, handler as POST, handler as PUT };
