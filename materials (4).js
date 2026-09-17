// The Launch Materials Center catalogue, in display order.
// kind "gdoc" = rendered live from a Google Doc; "cards" and "tracker" are built into the site.
export const MATERIALS = [
  { slug: 'not-at-ga-script', title: '“Not at GA” Script for Helios', kind: 'gdoc', docId: '1o55YdUZMCZnKqxfhPY_vdiHX3go7Uoi_z8FUiBoGfTQ', blurb: 'What to say when a customer asks for something Helios does not support at GA.' },
  { slug: 'ae-se-ramp-plan', title: 'AE & SE Ramp Plan', kind: 'gdoc', docId: '1yKeXyxsTGqYymjnJudYbisSjFkBSyGah0bGnDZxe8x4', blurb: 'How account executives and solutions engineers get ready to sell and support Helios.' },
  { slug: 'launch-narrative-messaging', title: 'Launch Narrative & Messaging', kind: 'gdoc', docId: '1PCQBiCc48zUsgHK9DFuYfnQu5WtbKV2wr8uHoszKMhM', blurb: 'The launch story and core messages.' },
  { slug: 'ae-account-cards', title: 'AE Account Cards', kind: 'cards', blurb: 'One card per wave 1 account: why now, CRM evidence, proof points, pilot scope and what not to sell.' },
  { slug: 'where-helios-fits', title: 'Where Helios Fits & Where It Doesn’t', kind: 'gdoc', docId: '1Z8Pdw4v-iu_oIPxrnoU7Yglw-Tl26SU__gxjQcbRnqQ', blurb: 'Qualification guide: where Helios is a fit at GA and where it is not.' },
  { slug: 'objection-faq', title: 'Objection FAQ', kind: 'gdoc', docId: '1Uu3L1QHidMCvWJczTF8KUQx2F_fIAwjkmrXR3BSLqzg', blurb: 'Answers to the objections sellers can expect.' },
  { slug: 'outreach-email-template', title: 'Outreach Email Template', kind: 'gdoc', docId: '1DFkbOi9CwmNowMfIt8WJpBPxOE_UBhvOWAv9cx002ik', blurb: 'Outreach email copy for target accounts.' },
  { slug: 'pilot-kit', title: 'Pilot Kit', kind: 'gdoc', docId: '1yJECTajR7H1VfZIsy5C-O9ywU4ljtbF_Nz8sXehMlI0', blurb: 'What is needed to scope and run a Helios pilot.' },
  { slug: 'launch-tracker', title: 'Launch Tracker', kind: 'tracker', blurb: 'Owners, milestones, risks and decisions, live from the stakeholder plan sheet.' },
];
export const bySlug = (slug) => MATERIALS.find((m) => m.slug === slug);
