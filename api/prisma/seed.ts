import { IssueStatus, Priority, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  // `--only-if-empty` is how the container seeds on first boot without wiping a
  // database that already has real data in it.
  if (process.argv.includes('--only-if-empty')) {
    const existing = await prisma.venue.count();
    if (existing > 0) {
      console.log(`Database already has ${existing} venue(s) — skipping seed.`);
      return;
    }
  }

  console.log('Seeding Third Wave BBQ...');

  // Idempotent: wipe in FK-safe order so `npm run seed` can be re-run.
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.user.deleteMany();
  await prisma.venue.deleteMany();

  const [newtown, parramatta, bondi] = await Promise.all([
    prisma.venue.create({ data: { name: 'Newtown', code: 'NTN' } }),
    prisma.venue.create({ data: { name: 'Parramatta', code: 'PAR' } }),
    prisma.venue.create({ data: { name: 'Bondi', code: 'BON' } }),
  ]);

  // Returns the id: everything below refers to users by id.
  const user = async (
    name: string,
    email: string,
    role: Role,
    venueId: string | null,
  ): Promise<string> =>
    (await prisma.user.create({ data: { name, email, role, venueId } })).id;

  // Head Office: no venue, sees everything.
  const priya = await user('Priya Raman', 'priya@thirdwavebbq.com', Role.HEAD_OFFICE, null);
  const marcus = await user('Marcus Webb', 'marcus@thirdwavebbq.com', Role.HEAD_OFFICE, null);

  const ntnManager = await user('Dana Ellis', 'dana@thirdwavebbq.com', Role.VENUE_MANAGER, newtown.id);
  const ntnStaff1 = await user('Tom Nguyen', 'tom@thirdwavebbq.com', Role.VENUE_STAFF, newtown.id);
  const ntnStaff2 = await user('Aisha Khan', 'aisha@thirdwavebbq.com', Role.VENUE_STAFF, newtown.id);

  const parManager = await user('Leo Fontaine', 'leo@thirdwavebbq.com', Role.VENUE_MANAGER, parramatta.id);
  const parStaff = await user('Grace Oyelaran', 'grace@thirdwavebbq.com', Role.VENUE_STAFF, parramatta.id);

  const bonManager = await user('Sam Whitlock', 'sam@thirdwavebbq.com', Role.VENUE_MANAGER, bondi.id);
  const bonStaff = await user('Rafi Haddad', 'rafi@thirdwavebbq.com', Role.VENUE_STAFF, bondi.id);

  type Spec = {
    venueId: string;
    title: string;
    description: string;
    priority: Priority;
    status: IssueStatus;
    reporterId: string;
    assigneeId?: string;
    dueInDays?: number;
  };

  const specs: Spec[] = [
    // --- Newtown ---
    {
      venueId: newtown.id,
      title: 'Main smoker not holding temperature',
      description:
        'Smoker #1 drops from 110C to about 85C within twenty minutes of loading a full brisket rack. Suspect the door seal. We are running dinner service on the backup smoker, which halves our capacity.',
      priority: Priority.URGENT,
      status: IssueStatus.IN_PROGRESS,
      reporterId: ntnStaff1,
      assigneeId: ntnManager,
      dueInDays: -1,
    },
    {
      venueId: newtown.id,
      title: 'Walk-in cool room running at 7C',
      description:
        'Walk-in has read 7C on the last three morning checks; it should be at or under 4C. Food safety log attached to the clipboard by the door. Moved all raw protein to the reach-in for now.',
      priority: Priority.URGENT,
      status: IssueStatus.OPEN,
      reporterId: ntnManager,
      assigneeId: priya,
      dueInDays: 1,
    },
    {
      venueId: newtown.id,
      title: 'Dishwasher rinse cycle leaving residue',
      description:
        'Glassware coming out spotted. Rinse aid was topped up on Tuesday so it is likely the jet arm. Rewashing by hand adds about 30 minutes to close.',
      priority: Priority.MEDIUM,
      status: IssueStatus.OPEN,
      reporterId: ntnStaff2,
      assigneeId: ntnStaff1,
      dueInDays: 5,
    },
    {
      venueId: newtown.id,
      title: 'Two pendant lights out over booth 4',
      description: 'Both bulbs in the pendant cluster above booth 4 have gone. Booth is noticeably dim at night.',
      priority: Priority.LOW,
      status: IssueStatus.OPEN,
      reporterId: ntnStaff2,
      dueInDays: 14,
    },
    {
      venueId: newtown.id,
      title: 'Front door closer slamming',
      description: 'The hydraulic closer has lost tension and the door bangs shut. Startling guests at the front tables.',
      priority: Priority.LOW,
      status: IssueStatus.CLOSED,
      reporterId: ntnStaff1,
      assigneeId: ntnManager,
      dueInDays: -20,
    },
    {
      venueId: newtown.id,
      title: 'EFTPOS terminal 2 dropping connection',
      description: 'Terminal 2 loses its connection during peak and needs a restart, roughly twice a service. Terminal 1 is unaffected.',
      priority: Priority.HIGH,
      status: IssueStatus.IN_PROGRESS,
      reporterId: ntnManager,
      assigneeId: marcus,
      dueInDays: 3,
    },
    {
      venueId: newtown.id,
      title: 'Extraction hood filters overdue for deep clean',
      description: 'Filters are visibly loaded with grease. Last recorded deep clean was four months ago; the schedule is quarterly.',
      priority: Priority.HIGH,
      status: IssueStatus.OPEN,
      reporterId: ntnStaff1,
      assigneeId: ntnManager,
      dueInDays: -4,
    },

    // --- Parramatta ---
    {
      venueId: parramatta.id,
      title: 'Grease trap overdue for pump-out',
      description:
        'Trap is at capacity and there is an odour in the back corridor. Council schedule says pump-out was due a fortnight ago.',
      priority: Priority.HIGH,
      status: IssueStatus.OPEN,
      reporterId: parStaff,
      assigneeId: parManager,
      dueInDays: -3,
    },
    {
      venueId: parramatta.id,
      title: 'Ice machine producing hollow cubes',
      description: 'Cubes come out hollow and melt almost immediately. Output is down maybe 40%, which is tight on a warm weekend.',
      priority: Priority.MEDIUM,
      status: IssueStatus.IN_PROGRESS,
      reporterId: parManager,
      assigneeId: parStaff,
      dueInDays: 6,
    },
    {
      venueId: parramatta.id,
      title: 'Accessible toilet door lock sticking',
      description: 'The indicator bolt jams halfway and guests have needed help getting out twice this week. Treating as a safety matter.',
      priority: Priority.URGENT,
      status: IssueStatus.OPEN,
      reporterId: parStaff,
      assigneeId: priya,
      dueInDays: 0,
    },
    {
      venueId: parramatta.id,
      title: 'Car park bay lines faded',
      description: 'Bay markings in the rear car park are worn to the point that guests are parking across two bays.',
      priority: Priority.LOW,
      status: IssueStatus.OPEN,
      reporterId: parManager,
      dueInDays: 30,
    },
    {
      venueId: parramatta.id,
      title: 'Cool room door gasket torn',
      description: 'Ten centimetre tear in the lower gasket. Icing up around the frame and the compressor is cycling more than it should.',
      priority: Priority.HIGH,
      status: IssueStatus.CLOSED,
      reporterId: parStaff,
      assigneeId: parManager,
      dueInDays: -10,
    },
    {
      venueId: parramatta.id,
      title: 'POS printer jamming on long dockets',
      description: 'Kitchen printer jams whenever a docket runs past about fifteen lines. Feed roller looks worn.',
      priority: Priority.MEDIUM,
      status: IssueStatus.OPEN,
      reporterId: parStaff,
      assigneeId: parManager,
      dueInDays: 8,
    },

    // --- Bondi ---
    {
      venueId: bondi.id,
      title: 'Rooftop awning motor failed',
      description:
        'The awning will not retract. Stuck fully extended, which is a problem with the wind we get here. Manual crank works but takes two people.',
      priority: Priority.URGENT,
      status: IssueStatus.IN_PROGRESS,
      reporterId: bonStaff,
      assigneeId: bonManager,
      dueInDays: 1,
    },
    {
      venueId: bondi.id,
      title: 'Salt corrosion on outdoor furniture frames',
      description: 'Rust is coming through on the legs of about a dozen outdoor chairs. Ocean air is doing its work faster than the coating holds up.',
      priority: Priority.MEDIUM,
      status: IssueStatus.OPEN,
      reporterId: bonManager,
      assigneeId: marcus,
      dueInDays: 21,
    },
    {
      venueId: bondi.id,
      title: 'Beer line chiller tripping breaker',
      description: 'Chiller has tripped the breaker three times in a week, always mid-service. Line temperature is drifting and pours are foamy.',
      priority: Priority.HIGH,
      status: IssueStatus.OPEN,
      reporterId: bonStaff,
      assigneeId: bonManager,
      dueInDays: -2,
    },
    {
      venueId: bondi.id,
      title: 'Sand ingress jamming front door track',
      description: 'The sliding door track packs with sand by mid-afternoon and the door sticks. Needs a sweep-out routine or a brush seal.',
      priority: Priority.LOW,
      status: IssueStatus.OPEN,
      reporterId: bonStaff,
      dueInDays: 12,
    },
    {
      venueId: bondi.id,
      title: 'Fire extinguisher tags expired',
      description: 'Three extinguishers in the kitchen are past their test date. Needs a certified inspection before the next audit.',
      priority: Priority.HIGH,
      status: IssueStatus.OPEN,
      reporterId: bonManager,
      assigneeId: priya,
      dueInDays: 4,
    },
    {
      venueId: bondi.id,
      title: 'Coffee machine group head leaking',
      description: 'Slow drip from the left group head between shots. Gasket is probably due for replacement.',
      priority: Priority.MEDIUM,
      status: IssueStatus.CLOSED,
      reporterId: bonStaff,
      assigneeId: bonStaff,
      dueInDays: -15,
    },
    {
      venueId: bondi.id,
      title: 'Rear exit light not illuminating',
      description: 'The emergency exit sign above the rear door is dark. Tested the switch, no response — likely the battery pack.',
      priority: Priority.URGENT,
      status: IssueStatus.OPEN,
      reporterId: bonStaff,
      assigneeId: bonManager,
      dueInDays: 2,
    },
  ];

  const created: { id: string }[] = [];
  for (const spec of specs) {
    created.push(
      await prisma.issue.create({
        data: {
          venueId: spec.venueId,
          title: spec.title,
          description: spec.description,
          priority: spec.priority,
          status: spec.status,
          reporterId: spec.reporterId,
          assigneeId: spec.assigneeId ?? null,
          dueDate: spec.dueInDays === undefined ? null : days(spec.dueInDays),
          closedAt: spec.status === IssueStatus.CLOSED ? days(-1) : null,
        },
      }),
    );
  }

  const comment = (issueId: string, authorId: string, body: string) =>
    prisma.comment.create({ data: { issueId, authorId, body } });

  await comment(created[0].id, ntnManager, 'Called the service agent, they can be here Thursday morning. Running on the backup until then.');
  await comment(created[0].id, priya, 'If Thursday slips, escalate to me and I will authorise the after-hours callout rate.');
  await comment(created[1].id, priya, 'Treat this as priority one. Log every temperature check until it is back under 4C.');
  await comment(created[7].id, parManager, 'Pump-out booked for Monday 6am, before open.');
  await comment(created[13].id, bonManager, 'Motor is out of warranty by two months. Getting a quote for a replacement unit.');
  await comment(created[16].id, bonStaff, 'Tripped again during Saturday dinner. Moving this up.');

  console.log(`
Seed complete.
  ${3} venues, ${9} users, ${created.length} issues, 6 comments

Sign in by picking a user in the switcher (top right). Useful ones:
  Priya Raman    HEAD_OFFICE     ${priya}
  Dana Ellis     Newtown manager ${ntnManager}
  Tom Nguyen     Newtown staff   ${ntnStaff1}
  Rafi Haddad    Bondi staff     ${bonStaff}
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
