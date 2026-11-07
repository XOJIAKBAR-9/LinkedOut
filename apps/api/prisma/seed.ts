/**
 * Seeds realistic fake data: ~50 users, 20 fictional companies, 200 posts,
 * comments, reactions, connections, conversations and groups.
 * Every company name below is invented. Do not add real companies.
 *
 * Every seeded user can log in with password "password123".
 * Demo login: demo@linkedout.test / password123
 */
import { faker } from "@faker-js/faker";
import { BANNER_PRESETS, bannerPresetUrl } from "@linkedout/shared";
import { PrismaClient, type ReactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
faker.seed(42);

const COMPANIES: { name: string; industry: string }[] = [
  { name: "Quillstone Labs", industry: "Developer Tools" },
  { name: "Brightfern Analytics", industry: "Data & Analytics" },
  { name: "Harborlight Health", industry: "Healthcare" },
  { name: "Copperwind Energy", industry: "Renewable Energy" },
  { name: "Mosslane Studios", industry: "Game Development" },
  { name: "Tidewater Logistics", industry: "Logistics" },
  { name: "Emberline Finance", industry: "Fintech" },
  { name: "Northpeak Robotics", industry: "Robotics" },
  { name: "Silverbirch Learning", industry: "Education" },
  { name: "Lumenfold Design", industry: "Design Agency" },
  { name: "Ravenmoor Security", industry: "Cybersecurity" },
  { name: "Glassreed Media", industry: "Media" },
  { name: "Pinecrest Biotech", industry: "Biotechnology" },
  { name: "Starling Orchard Foods", industry: "Food & Beverage" },
  { name: "Driftwood Cloudworks", industry: "Cloud Infrastructure" },
  { name: "Velvetoak Retail", industry: "Retail" },
  { name: "Cobaltriver Consulting", industry: "Management Consulting" },
  { name: "Whistlepine Travel", industry: "Travel" },
  { name: "Ironpetal Manufacturing", industry: "Manufacturing" },
  { name: "Saltmarsh Legal Tech", industry: "Legal Tech" },
];

const TITLES = [
  "Software Engineer", "Senior Software Engineer", "Product Manager", "Product Designer", "Data Scientist",
  "Engineering Manager", "Marketing Lead", "Sales Director", "Recruiter", "DevOps Engineer",
  "UX Researcher", "Frontend Developer", "Backend Developer", "Technical Writer", "Customer Success Manager",
];

const POST_TEMPLATES = [
  () => `Excited to share that I've started a new role as ${faker.helpers.arrayElement(TITLES)}! Grateful for everyone who helped along the way.`,
  () => `Three things I learned this quarter:\n1. ${faker.company.catchPhrase()}\n2. ${faker.company.catchPhrase()}\n3. Ship small, ship often.`,
  () => `We're hiring! Looking for a ${faker.helpers.arrayElement(TITLES)} who cares about ${faker.hacker.noun()}s. DM me.`,
  () => `Hot take: ${faker.hacker.phrase()}`,
  () => `Just wrapped up a talk on ${faker.hacker.adjective()} ${faker.hacker.noun()} design. Slides in the comments.`,
  () => `Reminder that it's okay to take a break. ${faker.lorem.sentence()}`,
  () => `Proud of the team for launching ${faker.commerce.productName()} this week. ${faker.lorem.sentences(2)}`,
  () => `Reading recommendation: anything about ${faker.word.noun()} and ${faker.word.noun()}. ${faker.lorem.sentence()}`,
];

const REACTIONS: ReactionType[] = ["LIKE", "LIKE", "LIKE", "CELEBRATE", "SUPPORT", "INSIGHTFUL", "FUNNY"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversationParticipant.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.group.deleteMany(),
    prisma.connection.deleteMany(),
    prisma.experience.deleteMany(),
    prisma.company.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.emailToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("password123", 10);

  console.log("Companies…");
  const companies = await Promise.all(
    COMPANIES.map((c) =>
      prisma.company.create({
        data: {
          name: c.name,
          slug: slugify(c.name),
          industry: c.industry,
          description: `${c.name} — ${faker.company.catchPhrase()}.`,
          size: faker.helpers.arrayElement(["1-10", "11-50", "51-200", "201-500", "501-1000"]),
          location: `${faker.location.city()}, ${faker.location.country()}`,
          website: `https://${slugify(c.name)}.example`,
        },
      }),
    ),
  );

  console.log("Users…");
  const users = [];
  for (let i = 0; i < 50; i++) {
    const firstName = i === 0 ? "Demo" : faker.person.firstName();
    const lastName = i === 0 ? "User" : faker.person.lastName();
    const company = faker.helpers.arrayElement(companies);
    const title = faker.helpers.arrayElement(TITLES);
    const user = await prisma.user.create({
      data: {
        email: i === 0 ? "demo@linkedout.test" : faker.internet.email({ firstName, lastName, provider: "example.test" }).toLowerCase(),
        passwordHash,
        emailVerified: true,
        isSample: true,
        firstName,
        lastName,
        headline: `${title} at ${company.name}`,
        about: faker.lorem.paragraphs(2),
        location: `${faker.location.city()}, ${faker.location.country()}`,
        bannerUrl:
          i === 0 || faker.number.float() < 0.6 ? bannerPresetUrl(faker.helpers.arrayElement(BANNER_PRESETS).id) : null,
        createdAt: faker.date.past({ years: 2 }),
        experiences: {
          create: [
            {
              title,
              companyId: company.id,
              companyName: company.name,
              startDate: faker.date.past({ years: 3 }),
              description: faker.lorem.sentences(2),
            },
            ...(faker.datatype.boolean()
              ? [
                  (() => {
                    const prev = faker.helpers.arrayElement(companies);
                    const start = faker.date.past({ years: 8, refDate: faker.date.past({ years: 3 }) });
                    return {
                      title: faker.helpers.arrayElement(TITLES),
                      companyId: prev.id,
                      companyName: prev.name,
                      startDate: start,
                      endDate: faker.date.between({ from: start, to: new Date() }),
                    };
                  })(),
                ]
              : []),
          ],
        },
      },
    });
    users.push(user);
  }

  console.log("Connections…");
  const pairs = new Set<string>();
  for (const u of users) {
    for (const other of faker.helpers.arrayElements(users, { min: 3, max: 10 })) {
      if (other.id === u.id) continue;
      const key = [u.id, other.id].sort().join(":");
      if (pairs.has(key)) continue;
      pairs.add(key);
      await prisma.connection.create({
        data: {
          requesterId: u.id,
          addresseeId: other.id,
          status: faker.number.float() < 0.85 ? "ACCEPTED" : "PENDING",
        },
      });
    }
  }

  console.log("Groups…");
  const groupNames = ["Frontend Guild", "Remote Work Circle", "Data Nerds", "Design Systems Club", "Founders & Builders", "Career Switchers"];
  const groups = [];
  for (const name of groupNames) {
    const owner = faker.helpers.arrayElement(users);
    const members = faker.helpers.arrayElements(users.filter((u) => u.id !== owner.id), { min: 5, max: 15 });
    groups.push(
      await prisma.group.create({
        data: {
          name,
          slug: slugify(name),
          description: faker.lorem.sentence(),
          ownerId: owner.id,
          members: {
            create: [{ userId: owner.id, role: "ADMIN" }, ...members.map((m) => ({ userId: m.id }))],
          },
        },
      }),
    );
  }

  console.log("Posts, comments, reactions…");
  for (let i = 0; i < 200; i++) {
    const author = faker.helpers.arrayElement(users);
    const createdAt = faker.date.recent({ days: 60 });
    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        content: faker.helpers.arrayElement(POST_TEMPLATES)(),
        imageUrl: faker.number.float() < 0.2 ? `https://picsum.photos/seed/lo${i}/800/450` : null,
        groupId: faker.number.float() < 0.1 ? faker.helpers.arrayElement(groups).id : null,
        createdAt,
      },
    });

    const commenters = faker.helpers.arrayElements(users, { min: 0, max: 5 });
    if (commenters.length) {
      await prisma.comment.createMany({
        data: commenters.map((c) => ({
          postId: post.id,
          authorId: c.id,
          content: faker.helpers.arrayElement(["Congrats! 🎉", "Great insight.", "Thanks for sharing!", faker.lorem.sentence()]),
          createdAt: faker.date.between({ from: createdAt, to: new Date() }),
        })),
      });
    }

    // Some comments get a short reply thread.
    if (commenters.length && faker.number.float() < 0.4) {
      const top = await prisma.comment.findMany({ where: { postId: post.id }, select: { id: true, authorId: true, createdAt: true } });
      const target = faker.helpers.arrayElement(top);
      let last = target;
      for (const replier of faker.helpers.arrayElements(users, { min: 1, max: 3 })) {
        last = await prisma.comment.create({
          data: {
            postId: post.id,
            parentId: target.id,
            replyToId: last.authorId,
            authorId: replier.id,
            content: faker.helpers.arrayElement(["Totally agree!", "Good point.", "Thanks! 🙌", "Couldn't have said it better.", faker.lorem.sentence()]),
            createdAt: faker.date.between({ from: last.createdAt, to: new Date() }),
          },
          select: { id: true, authorId: true, createdAt: true },
        });
      }
    }

    const reactors = faker.helpers.arrayElements(users, { min: 0, max: 20 });
    if (reactors.length) {
      await prisma.reaction.createMany({
        data: reactors.map((r) => ({ postId: post.id, userId: r.id, type: faker.helpers.arrayElement(REACTIONS) })),
      });
    }
  }

  console.log("Conversations…");
  const demo = users[0]!;
  for (let i = 0; i < 25; i++) {
    const a = i < 8 ? demo : faker.helpers.arrayElement(users);
    const b = faker.helpers.arrayElement(users.filter((u) => u.id !== a.id));
    const exists = await prisma.conversation.findFirst({
      where: { AND: [{ participants: { some: { userId: a.id } } }, { participants: { some: { userId: b.id } } }] },
    });
    if (exists) continue;
    let t = faker.date.recent({ days: 14 }).getTime();
    const msgs = Array.from({ length: faker.number.int({ min: 2, max: 12 }) }, () => {
      t += faker.number.int({ min: 1, max: 180 }) * 60_000;
      return {
        senderId: faker.helpers.arrayElement([a.id, b.id]),
        content: faker.helpers.arrayElement([
          "Hey! How have you been?",
          "Would love to catch up sometime.",
          "Thanks for the intro!",
          "Are you going to the meetup next week?",
          faker.lorem.sentence(),
        ]),
        createdAt: new Date(Math.min(t, Date.now())),
      };
    });
    await prisma.conversation.create({
      data: {
        updatedAt: msgs.at(-1)!.createdAt,
        // Mark seeded conversations as read, except two of the demo user's, so the unread badge has something to show.
        participants: {
          create: [
            { userId: a.id, lastReadAt: a.id === demo.id && i < 2 ? null : msgs.at(-1)!.createdAt },
            { userId: b.id, lastReadAt: msgs.at(-1)!.createdAt },
          ],
        },
        messages: { create: msgs },
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    reactions: await prisma.reaction.count(),
    connections: await prisma.connection.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
    groups: await prisma.group.count(),
  };
  console.log("Seeded:", counts);
  console.log("Log in as demo@linkedout.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
