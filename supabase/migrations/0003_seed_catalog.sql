-- Little Atlas — curated starter catalog seed data.
-- Generated from src/data/catalogSeed.json (keep the two in sync; the
-- frontend bundles the JSON directly for guest/offline use, while this
-- populates the database copy that signed-in users read from).
--
-- Idempotent: safe to re-run. Uses upsert-by-id so re-seeding after edits
-- to catalogSeed.json updates existing rows rather than duplicating them.

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'movement-walking',
  'movement',
  'Low-key cardio',
  'Everyday walking',
  'Building a regular walk into your week — around the block, a park loop, or just further from the bus stop.',
  ARRAY['May help you get a bit more daily movement in', 'Can be a low-pressure way to clear your head between tasks'],
  ARRAY['Pick one existing errand or habit to walk part of instead of ride', 'Try a 10-minute loop from your door and see how it feels', 'Notice one new thing on the route each time'],
  'Free · 10–30 min · just a pair of comfortable shoes',
  ARRAY['nature-hiking-local', 'wellbeing-gentle-stretching'],
  ARRAY['walk', 'walking', 'steps', 'outside', 'cardio', 'move more'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'movement-couch-to-5k',
  'movement',
  'Running',
  'Beginner run/walk plans',
  'Structured plans that alternate walking and short jogs, designed for people who don''t currently run at all.',
  ARRAY['May build cardiovascular fitness gradually', 'Structured plans can reduce guesswork about pacing yourself'],
  ARRAY['Find a free beginner run/walk plan online', 'Do the first session at an easy, conversational pace', 'Rest at least a day between sessions at first'],
  'Free plans available · ~20–30 min per session · running shoes recommended',
  ARRAY['movement-walking', 'wellbeing-gentle-stretching'],
  ARRAY['run', 'running', 'jog', '5k', 'fitness', 'cardio'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'movement-dance-basics',
  'movement',
  'Dance',
  'Dance basics at home',
  'Following short, beginner-friendly dance videos to move to music without any performance pressure.',
  ARRAY['May be a playful way to enjoy music and movement together', 'No partner or class required to get a feel for it'],
  ARRAY['Pick one style that sounds fun (e.g. hip-hop basics, salsa steps)', 'Search for a 10-minute beginner tutorial', 'Do it once through slowly before trying it at speed'],
  'Free · 10–20 min · open floor space',
  ARRAY['people-local-meetup'],
  ARRAY['dance', 'dancing', 'music', 'movement'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'mind-logic-chess',
  'mind_logic',
  'Strategy games',
  'Chess fundamentals',
  'Learning how the pieces move and a few opening ideas, then playing low-stakes games online or with friends.',
  ARRAY['May give you a satisfying puzzle to chew on', 'Playing regularly can sharpen planning-ahead thinking'],
  ARRAY['Learn how each piece moves', 'Play a few games against an easy computer opponent', 'Learn one opening principle: control the center early'],
  'Free to start · 15+ min per game · any device or a physical board',
  ARRAY['mind-logic-puzzles'],
  ARRAY['chess', 'strategy', 'board game', 'puzzle', 'logic'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'mind-logic-puzzles',
  'mind_logic',
  'Puzzles',
  'Logic puzzles & sudoku',
  'Short daily puzzles — sudoku, crosswords, or logic grid puzzles — as a quiet mental warm-up.',
  ARRAY['Can be a calm, focused break from screens full of notifications', 'May be satisfying without needing a big time commitment'],
  ARRAY['Pick one puzzle type to try for a week', 'Start with ''easy'' difficulty even if it feels too simple at first', 'Keep a small notebook if you want to track ones you enjoyed'],
  'Free · 5–15 min · pen and paper or a puzzle app',
  ARRAY['mind-logic-chess', 'mind-logic-language-basics'],
  ARRAY['puzzle', 'sudoku', 'crossword', 'logic', 'brain'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'mind-logic-language-basics',
  'mind_logic',
  'Language',
  'Starting a new language',
  'Picking up basic phrases and vocabulary in a language you''re drawn to, at whatever pace feels light.',
  ARRAY['May be useful for travel or connecting with people', 'Short daily practice can build vocabulary steadily over time'],
  ARRAY['Choose a language and a free app or course', 'Learn 5 everyday phrases first (greetings, thanks, basic questions)', 'Practice out loud, even alone, for a few minutes a day'],
  'Free tier widely available · 5–15 min/day · phone or laptop',
  ARRAY['mind-logic-puzzles', 'people-local-meetup'],
  ARRAY['language', 'learning', 'vocabulary', 'linguistics'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'creativity-sketching',
  'creativity',
  'Visual art',
  'Everyday sketching',
  'Drawing small, low-stakes sketches of things around you — no talent requirement, just noticing shapes.',
  ARRAY['May help you notice everyday surroundings differently', 'Low-pressure practice can build comfort with a pencil over time'],
  ARRAY['Get any notebook and pencil', 'Sketch one object near you for 5 minutes without erasing', 'Repeat with a different object tomorrow'],
  'Cheap (paper + pencil) · 5–15 min · anywhere',
  ARRAY['creativity-journaling'],
  ARRAY['draw', 'drawing', 'sketch', 'art', 'visual'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'creativity-journaling',
  'creativity',
  'Writing',
  'Reflective journaling',
  'Writing a few unstructured sentences about your day or thoughts — no audience, no formatting rules.',
  ARRAY['Some people find writing things down helps them process the day', 'May be a private space to notice patterns in your thinking'],
  ARRAY['Pick a notebook or a plain notes app', 'Write 3 sentences about today, good or ordinary', 'Skip days without guilt — there''s no streak here'],
  'Free · 5 min · notebook or phone',
  ARRAY['creativity-sketching', 'wellbeing-breathing-basics'],
  ARRAY['journal', 'journaling', 'writing', 'reflection', 'diary'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'creativity-music-basics',
  'creativity',
  'Music',
  'Picking up an instrument',
  'Trying a beginner-friendly instrument (ukulele, keyboard, or just your voice) with free starter lessons.',
  ARRAY['May give you a creative outlet that doesn''t require an audience', 'Learning a new skill step-by-step can be quietly rewarding'],
  ARRAY['Pick an instrument that''s cheap or already in your house', 'Learn 3 basic chords or notes', 'Try playing along to one simple song'],
  'Instrument cost varies (ukuleles are inexpensive) · 15–20 min · free tutorials online',
  ARRAY['creativity-sketching'],
  ARRAY['music', 'instrument', 'guitar', 'ukulele', 'piano', 'sing'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'people-board-games-night',
  'people',
  'Games with others',
  'Casual board game nights',
  'Inviting a couple of people over (or joining a local group) for low-key board or card games.',
  ARRAY['May be an easy, structured way to spend time with others', 'Games can take the pressure off ''small talk'' as the main activity'],
  ARRAY['Pick one simple game you already own or can borrow', 'Invite 1-2 people for a casual evening', 'Keep the first one short — an hour is plenty'],
  'Low cost · 1–2 hrs · a table and a couple of people',
  ARRAY['mind-logic-chess', 'people-local-meetup'],
  ARRAY['board game', 'games night', 'friends', 'social', 'cards'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'people-volunteering',
  'people',
  'Community',
  'Local volunteering',
  'Giving a small, occasional amount of time to a local cause you care about.',
  ARRAY['May connect you with people who share your interests', 'Some people find a sense of purpose in contributing locally'],
  ARRAY['Think of one cause you already care about', 'Search for a local group or shelter that welcomes occasional help', 'Try a single short shift before committing to anything regular'],
  'Free · a few hours, flexible · local availability varies',
  ARRAY['people-local-meetup', 'nature-gardening-container'],
  ARRAY['volunteer', 'community', 'helping', 'charity'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'people-local-meetup',
  'people',
  'Meeting people',
  'Interest-based local meetups',
  'Finding a casual local group built around a specific interest, so conversation has a built-in topic.',
  ARRAY['May make meeting new people feel less pressured, since there''s a shared activity', 'Regular casual contact can help new interests stick'],
  ARRAY['Search for groups around one interest you already have', 'Read a couple of recent posts or reviews before going', 'Go once with no expectation beyond trying it'],
  'Often free or low-cost · 1–2 hrs · local availability varies',
  ARRAY['people-board-games-night', 'mind-logic-language-basics'],
  ARRAY['meetup', 'social', 'friends', 'community', 'group'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'nature-birdwatching',
  'nature',
  'Observing wildlife',
  'Casual bird watching',
  'Noticing and identifying birds you already see around your home or local park.',
  ARRAY['May be a gentle reason to spend time outside', 'Some people find identifying things around them satisfying'],
  ARRAY['Sit somewhere outdoors for 10 minutes and just notice birds', 'Try a free bird identification app or field guide', 'Keep a simple running list of ones you''ve spotted'],
  'Free (binoculars optional) · 10–30 min · a window or park',
  ARRAY['nature-hiking-local'],
  ARRAY['birds', 'birdwatching', 'wildlife', 'outdoors', 'nature'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'nature-gardening-container',
  'nature',
  'Growing things',
  'Container gardening',
  'Growing a herb or vegetable in a pot on a windowsill or balcony — no yard required.',
  ARRAY['May be a small, tangible project to check in on', 'Growing something you can eat can feel rewarding'],
  ARRAY['Pick one easy plant (basil, mint, or cherry tomatoes)', 'Get a pot, soil, and seeds or a starter plant', 'Water on a simple schedule and check in every few days'],
  'Low cost · a few minutes every few days · pot + windowsill/balcony',
  ARRAY['nature-birdwatching', 'wellbeing-gentle-stretching'],
  ARRAY['garden', 'gardening', 'plants', 'grow', 'herbs'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'nature-hiking-local',
  'nature',
  'Getting outside',
  'Local trails & hiking',
  'Exploring nearby trails or green spaces, starting with short, easy routes.',
  ARRAY['May combine movement with time outdoors', 'Exploring somewhere new nearby can feel refreshing'],
  ARRAY['Search for an easy, short trail near you', 'Check weather and bring water', 'Go at an easy pace — this isn''t a race'],
  'Free or low-cost · 30–90 min · comfortable shoes',
  ARRAY['movement-walking', 'nature-birdwatching'],
  ARRAY['hike', 'hiking', 'trail', 'outdoors', 'nature'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'tech-making-scratch-coding',
  'technology_making',
  'Coding',
  'Beginner-friendly coding',
  'Building small, visual projects with beginner coding tools rather than jumping into a full programming language.',
  ARRAY['May give a concrete sense of how software is built', 'Small visible projects can feel satisfying quickly'],
  ARRAY['Try a beginner-friendly visual coding tool', 'Follow one short tutorial to build a tiny project (like a simple game)', 'Change one thing in the project and see what happens'],
  'Free · 20–40 min · any computer',
  ARRAY['tech-making-electronics-kits'],
  ARRAY['code', 'coding', 'programming', 'scratch', 'software'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'tech-making-electronics-kits',
  'technology_making',
  'Hands-on building',
  'Beginner electronics kits',
  'Trying a starter electronics kit to build a small circuit or gadget with step-by-step instructions.',
  ARRAY['May be a satisfying hands-on way to learn how things work', 'Following clear steps to a working result can feel rewarding'],
  ARRAY['Find a beginner electronics kit with a guide', 'Set aside an evening with no distractions', 'Build the first small project exactly as instructed before experimenting'],
  'Kit cost varies (often modest) · 1–2 hrs · table space',
  ARRAY['tech-making-scratch-coding', 'tech-making-3d-printing-intro'],
  ARRAY['electronics', 'circuits', 'maker', 'building', 'hardware'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'tech-making-3d-printing-intro',
  'technology_making',
  'Hands-on building',
  'Intro to 3D printing',
  'Downloading and printing a small pre-made design, before ever designing your own.',
  ARRAY['May be a fun way to see an idea become a physical object', 'Browsing existing designs can spark other project ideas'],
  ARRAY['Find a place offering 3D printer access (library, makerspace, or a friend''s printer)', 'Download one simple, small pre-made design', 'Watch it print before attempting your own design'],
  'Access varies (libraries/makerspaces often free) · 1+ hr per print',
  ARRAY['tech-making-electronics-kits'],
  ARRAY['3d printing', 'maker', 'design', 'printer'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'wellbeing-breathing-basics',
  'wellbeing',
  'Calm',
  'Simple breathing exercises',
  'A short, structured breathing pattern you can do anywhere when you want a brief pause.',
  ARRAY['Some people find slow breathing helps them feel a bit steadier in the moment', 'Doesn''t require any equipment or set-up'],
  ARRAY['Sit comfortably and breathe in for 4 counts', 'Hold gently for 4 counts', 'Breathe out slowly for 6 counts, repeat a few times'],
  'Free · 2–5 min · anywhere',
  ARRAY['wellbeing-sleep-hygiene', 'creativity-journaling'],
  ARRAY['breathing', 'calm', 'stress', 'relax', 'mindfulness'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'wellbeing-sleep-hygiene',
  'wellbeing',
  'Rest',
  'Gentle sleep routines',
  'Small, realistic tweaks to your evening routine that may support easier winding down.',
  ARRAY['A consistent wind-down routine may make it easier to settle at night for some people', 'Small changes are easier to sustain than a full routine overhaul'],
  ARRAY['Pick one small change (e.g. phone out of reach 20 min before bed)', 'Try it for a few nights without judging results too soon', 'Adjust based on what actually felt different, if anything'],
  'Free · ongoing, a few minutes to set up · no equipment',
  ARRAY['wellbeing-breathing-basics'],
  ARRAY['sleep', 'rest', 'wind down', 'night routine'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

insert into public.catalog_items
  (id, category, subcategory, label, description, possible_benefits, beginner_steps, time_cost_access, related, keywords, source_label, reviewed_on)
values (
  'wellbeing-gentle-stretching',
  'wellbeing',
  'Body',
  'Gentle stretching',
  'A short daily stretch routine, focused on comfort rather than flexibility goals.',
  ARRAY['May help you notice tension in your body', 'A short routine can be easier to actually keep up than a long one'],
  ARRAY['Pick 3 simple stretches (neck, shoulders, hamstrings)', 'Hold each gently for 20–30 seconds, never to the point of pain', 'Do it at a consistent time, like after waking up'],
  'Free · 5–10 min · a bit of floor space',
  ARRAY['movement-walking', 'wellbeing-breathing-basics'],
  ARRAY['stretch', 'stretching', 'flexibility', 'body', 'relax'],
  'Curated by Little Atlas team',
  '2026-09-23'
)
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  label = excluded.label,
  description = excluded.description,
  possible_benefits = excluded.possible_benefits,
  beginner_steps = excluded.beginner_steps,
  time_cost_access = excluded.time_cost_access,
  related = excluded.related,
  keywords = excluded.keywords,
  source_label = excluded.source_label,
  reviewed_on = excluded.reviewed_on;

-- Clear and re-insert links per catalog item (simplest way to keep this
-- idempotent without a natural link id).
delete from public.catalog_links where catalog_id = 'movement-walking';
insert into public.catalog_links (catalog_id, label, url) values ('movement-walking', 'Overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Walking');

delete from public.catalog_links where catalog_id = 'movement-couch-to-5k';
insert into public.catalog_links (catalog_id, label, url) values ('movement-couch-to-5k', 'NHS — exercise guidance', 'https://www.nhs.uk');
insert into public.catalog_links (catalog_id, label, url) values ('movement-couch-to-5k', 'Overview of run/walk method (Wikipedia)', 'https://en.wikipedia.org/wiki/Couch_to_5K');

delete from public.catalog_links where catalog_id = 'movement-dance-basics';
insert into public.catalog_links (catalog_id, label, url) values ('movement-dance-basics', 'Dance styles overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Dance');

delete from public.catalog_links where catalog_id = 'mind-logic-chess';
insert into public.catalog_links (catalog_id, label, url) values ('mind-logic-chess', 'Chess.com', 'https://www.chess.com');
insert into public.catalog_links (catalog_id, label, url) values ('mind-logic-chess', 'Overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Chess');

delete from public.catalog_links where catalog_id = 'mind-logic-puzzles';
insert into public.catalog_links (catalog_id, label, url) values ('mind-logic-puzzles', 'Overview of logic puzzles (Wikipedia)', 'https://en.wikipedia.org/wiki/Puzzle');

delete from public.catalog_links where catalog_id = 'mind-logic-language-basics';
insert into public.catalog_links (catalog_id, label, url) values ('mind-logic-language-basics', 'Duolingo', 'https://www.duolingo.com');

delete from public.catalog_links where catalog_id = 'creativity-sketching';
insert into public.catalog_links (catalog_id, label, url) values ('creativity-sketching', 'Drawing overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Drawing');

delete from public.catalog_links where catalog_id = 'creativity-journaling';
insert into public.catalog_links (catalog_id, label, url) values ('creativity-journaling', 'Overview of journaling (Wikipedia)', 'https://en.wikipedia.org/wiki/Journal_writing');

delete from public.catalog_links where catalog_id = 'creativity-music-basics';
insert into public.catalog_links (catalog_id, label, url) values ('creativity-music-basics', 'Overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Musical_instrument');

delete from public.catalog_links where catalog_id = 'people-board-games-night';
insert into public.catalog_links (catalog_id, label, url) values ('people-board-games-night', 'Overview of board games (Wikipedia)', 'https://en.wikipedia.org/wiki/Board_game');

delete from public.catalog_links where catalog_id = 'people-volunteering';
insert into public.catalog_links (catalog_id, label, url) values ('people-volunteering', 'Overview of volunteering (Wikipedia)', 'https://en.wikipedia.org/wiki/Volunteering');

delete from public.catalog_links where catalog_id = 'people-local-meetup';
insert into public.catalog_links (catalog_id, label, url) values ('people-local-meetup', 'Meetup', 'https://www.meetup.com');

delete from public.catalog_links where catalog_id = 'nature-birdwatching';
insert into public.catalog_links (catalog_id, label, url) values ('nature-birdwatching', 'Overview (Wikipedia)', 'https://en.wikipedia.org/wiki/Birdwatching');
insert into public.catalog_links (catalog_id, label, url) values ('nature-birdwatching', 'iNaturalist (species identification)', 'https://www.inaturalist.org');

delete from public.catalog_links where catalog_id = 'nature-gardening-container';
insert into public.catalog_links (catalog_id, label, url) values ('nature-gardening-container', 'Overview of container gardening (Wikipedia)', 'https://en.wikipedia.org/wiki/Container_garden');
insert into public.catalog_links (catalog_id, label, url) values ('nature-gardening-container', 'Royal Horticultural Society', 'https://www.rhs.org.uk');

delete from public.catalog_links where catalog_id = 'nature-hiking-local';
insert into public.catalog_links (catalog_id, label, url) values ('nature-hiking-local', 'Overview of hiking (Wikipedia)', 'https://en.wikipedia.org/wiki/Hiking');

delete from public.catalog_links where catalog_id = 'tech-making-scratch-coding';
insert into public.catalog_links (catalog_id, label, url) values ('tech-making-scratch-coding', 'Scratch', 'https://scratch.mit.edu');
insert into public.catalog_links (catalog_id, label, url) values ('tech-making-scratch-coding', 'Khan Academy', 'https://www.khanacademy.org');

delete from public.catalog_links where catalog_id = 'tech-making-electronics-kits';
insert into public.catalog_links (catalog_id, label, url) values ('tech-making-electronics-kits', 'Overview of electronics (Wikipedia)', 'https://en.wikipedia.org/wiki/Electronics');

delete from public.catalog_links where catalog_id = 'tech-making-3d-printing-intro';
insert into public.catalog_links (catalog_id, label, url) values ('tech-making-3d-printing-intro', 'Thingiverse (printable designs)', 'https://www.thingiverse.com');

delete from public.catalog_links where catalog_id = 'wellbeing-breathing-basics';
insert into public.catalog_links (catalog_id, label, url) values ('wellbeing-breathing-basics', 'Overview of breathing exercises (Wikipedia)', 'https://en.wikipedia.org/wiki/Diaphragmatic_breathing');

delete from public.catalog_links where catalog_id = 'wellbeing-sleep-hygiene';
insert into public.catalog_links (catalog_id, label, url) values ('wellbeing-sleep-hygiene', 'Overview of sleep hygiene (Wikipedia)', 'https://en.wikipedia.org/wiki/Sleep_hygiene');

delete from public.catalog_links where catalog_id = 'wellbeing-gentle-stretching';
insert into public.catalog_links (catalog_id, label, url) values ('wellbeing-gentle-stretching', 'Overview of stretching (Wikipedia)', 'https://en.wikipedia.org/wiki/Stretching');

