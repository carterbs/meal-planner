--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Debian 14.17-1.pgdg120+1)
-- Dumped by pg_dump version 14.17 (Debian 14.17-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: mealuser
--

CREATE TABLE public.ingredients (
    id integer NOT NULL,
    meal_id integer,
    quantity text,
    unit text,
    name text NOT NULL
);


ALTER TABLE public.ingredients OWNER TO mealuser;

--
-- Name: ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: mealuser
--

CREATE SEQUENCE public.ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ingredients_id_seq OWNER TO mealuser;

--
-- Name: ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mealuser
--

ALTER SEQUENCE public.ingredients_id_seq OWNED BY public.ingredients.id;


--
-- Name: meals; Type: TABLE; Schema: public; Owner: mealuser
--

CREATE TABLE public.meals (
    id integer NOT NULL,
    meal_name text NOT NULL,
    relative_effort integer NOT NULL,
    last_planned timestamp without time zone,
    red_meat boolean DEFAULT false NOT NULL,
    url text
);


ALTER TABLE public.meals OWNER TO mealuser;

--
-- Name: meals_id_seq; Type: SEQUENCE; Schema: public; Owner: mealuser
--

CREATE SEQUENCE public.meals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.meals_id_seq OWNER TO mealuser;

--
-- Name: meals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mealuser
--

ALTER SEQUENCE public.meals_id_seq OWNED BY public.meals.id;


--
-- Name: recipe_steps; Type: TABLE; Schema: public; Owner: mealuser
--

CREATE TABLE public.recipe_steps (
    id integer NOT NULL,
    meal_id integer NOT NULL,
    step_number integer NOT NULL,
    instruction text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.recipe_steps OWNER TO mealuser;

--
-- Name: recipe_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: mealuser
--

CREATE SEQUENCE public.recipe_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.recipe_steps_id_seq OWNER TO mealuser;

--
-- Name: recipe_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mealuser
--

ALTER SEQUENCE public.recipe_steps_id_seq OWNED BY public.recipe_steps.id;


--
-- Name: ingredients id; Type: DEFAULT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.ingredients ALTER COLUMN id SET DEFAULT nextval('public.ingredients_id_seq'::regclass);


--
-- Name: meals id; Type: DEFAULT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.meals ALTER COLUMN id SET DEFAULT nextval('public.meals_id_seq'::regclass);


--
-- Name: recipe_steps id; Type: DEFAULT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.recipe_steps ALTER COLUMN id SET DEFAULT nextval('public.recipe_steps_id_seq'::regclass);


--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: mealuser
--

COPY public.ingredients (id, meal_id, quantity, unit, name) FROM stdin;
218	31	1		breakfast sausage
231	33	1		pork tenderloin
233	33	1		fig preserves
234	33	1		frozen broccoli
237	34	1		Salad greens
238	34	1		Potato chips
239	34	1		cheddar cheese
110	15	1	\N	mustard
119	16	1	\N	pepperjack cheese
122	17	1	\N	paprika
123	17	1	\N	pepper
124	17	1	\N	cumin
126	17	1	\N	salt
127	17	1	\N	red wine vinegar
128	17	1	\N	garlic
129	17	1	\N	olive oil
132	17	1	\N	pepper
136	18	1	\N	garlic
163	24	1	\N	olive oil
164	24	1	\N	pepper
165	24	1	\N	red wine vinegar
173	25	1	\N	olive oil
185	27	1	\N	salt
186	27	1	\N	salt
187	27	1	\N	mustard
190	27	1	\N	pepper
193	28	1	\N	olive oil
194	28	1	\N	pepper
197	28	1	\N	mustard
198	28	1	\N	2 teaspoons apple cider vinegar
202	29	1	\N	onion powder
203	29	1	\N	garlic powder
204	29	1	\N	cumin
205	29	1	\N	salt
219	32	1	\N	olive oil
222	32	1	\N	salt
223	32	1	\N	garlic
226	32	1	\N	pepper
232	33	1	\N	mustard
240	34	1	\N	pepperjack cheese
248	36	1	\N	olive oil
249	36	1	\N	garlic
250	36	1	\N	salt
251	36	1	\N	pepper
252	36	1	\N	cumin
253	36	1	\N	paprika
254	36	1	\N	turmeric
256	36	1	\N	pepper
275	38	1	\N	onion powder
278	38	1	\N	pepper
279	39	1	\N	olive oil
281	39	1	\N	salt
285	39	1	\N	paprika
287	39	1	\N	cumin
288	39	1	\N	garlic powder
80	10	1	\N	.5 cup roughly cilantro
82	10	1	\N	.25 cup mayonnaise
83	10	1	\N	.5 cup sour cream
88	10	1	\N	.5 cup flour, preferably Wondra or other fine-milled flour
90	10	1	\N	.5 cup milk
91	10	1	\N	.25 cup peanut oil, plus a splash more for greasing pan
121	17	1	\N	.25 cup dried oregano
125	17	1	\N	.5 cup hot water
130	17	1	\N	.25 cup fresh oregano leaves, finely
422	51	2		Pillsbury pizza dough tubes
423	51	80		pepperoni slices
424	51	20		mozzarella cheese sticks
425	51	4	tbsp	butter
426	51	2	tbsp	grated parmesan cheese
427	51	0		marinara sauce for dipping
428	52	1		5 cheese freschetta frozen pizza
429	52	1		pepperoni freschetta frozen pizza
8	1	1	lb	smoked ham (3 cups)
9	2	1		tortellini
10	2	1		rotisserie chicken
11	3	1		Frozen pancakes
12	3	1		18 eggs
1	1	1	\N	salt
4	1	1	\N	mustard
13	3	1	\N	thick cut bacon
16	4	1	\N	.5 cup onion
17	4	1	\N	.5 cup drained capers
18	4	1	\N	.5 cup yogurt
19	4	1	\N	.75 cup mayonnaise, preferably homemade
2	1	1	jumbo	sweet onion, such as Vidalia (3 cups)
3	1	4	flats	of party rolls (see Tip)
5	1	3	tablespoons	poppy seeds
6	1	1	teaspoon	Worcestershire sauce
7	1	6	ounces	Swiss cheese (2 cups)
15	4	1	cup	celery
14	4	1	poached	chicken, 3.5 pounds
27	5	2	lb	93% lean ground beef
40	7	2	lb	99% lean ground chicken
23	4	1	tablespoon	parsley
24	4	2	tablespoons	scallions
25	4	8	to	12 slices rye bread, either freshly toasted or left untoasted
30	5	20	ct	tortillas
114	16	2	lb	93% lean ground beef
41	7	2	Honeycrisp	apples
93	10	1	lb	flounder or any firm white-fleshed fish, cut across the grain of the flesh into strips about .5 inch wide by 3 inches long
51	8	1	large	celery stalk
52	8	1	green	onion
55	8	3	tablespoons	lemon juice
32	5	1		avocado
33	5	1		red onion
34	5	1		1 tomato
59	8	4	ciabatta	sandwich rolls
35	5	1		cilantro
36	6	1		pork tenderloin
37	6	1		blackberry jam
66	9	3	garlic	cloves
67	9	1	tablespoon	tomato paste
70	9	1	cup	low-sodium chicken stock
39	6	1		frozen vegetables
77	10	2	medium	tomatoes and
78	10	1	small	red onion and
42	7	1	pack	Brioche buns
81	10	1	jalapeño,	lengthwise and cut crosswise into half moons (optional)
47	7	1	bag	Lays potato chips
44	7	1	pack	Cheddar cheese
84	10	2	limes,	1 and 1
76	9	1		plain naan
92	10	1		
45	7	8	oz	white cheddar cabot
100	12	1		parmesan cheese
94	10	12	6-inch	fresh corn tortillas
95	10	2	cups	shredded green cabbage
97	11	5	NY	Strip Steak
98	11	1	lb	petite red potatoes
99	12	1	lb	spaghetti noodles
101	12	1		onion
103	12	28	oz	prego spaghetti sauce
107	14	2	boxes	of Thick and fluffy eggo waffles
106	13	1		frozen vegetables
109	15	1		Pork chops
120	17	5	ny	strip steaks
111	15	1		Peach preserves
112	15	1		microwave rice
113	15	1		frozen broccoli
115	16	1		feta cheese
116	16	1		Salad greens
117	16	1		Potato chips
118	16	1		cheddar cheese
131	17	1	tightly	packed cup fresh parsley leaves, finely
133	17	1		Microwave rice
135	18	1	lb	linguine
134	17	1		Salad greens
61	9	3	large	boneless, skinless chicken breasts, or 6 chicken cutlets (about 2.25 pounds total), patted dry
21	4	1	\N	salt to taste, if desired
137	18	1		butter
138	18	1		Italian bread
140	3	1		Eggs
26	4	1	\N	Pickle strips, radishes or cherry tomatoes, for garnish
28	5	1	\N	Tostitos hint of lime chips
29	5	1	\N	Tostitos medium salsa
31	5	1	\N	shredded mexican cheese
46	7	1	\N	Harvest farms salad
48	8	1	\N	2(5-ounce) cans tuna in water
60	8	1	\N	Potato chips, for serving
69	9	1	\N	Red-pepper flakes, to taste
74	9	1	\N	Fresh basil, for serving
96	10	1	\N	A saucy hot sauce, like Tapatio or Frank’s
104	13	1	\N	tyson dinosaur nuggets
105	13	1	\N	kraft deluxe macaroni and cheese
108	14	1	\N	Maple breakfast sausage
139	3	1	\N	Thick cut bacon
49	8	1	\N	.25 cup plus 2 tablespoons mayonnaise
50	8	1	\N	.5 cup sour dill pickles (from 2 small)
53	8	1	\N	.25 cup fresh dill or 1 tablespoon dried dill
54	8	1	\N	.5 cup fresh parsley
63	9	1	\N	.25 cup all-purpose flour
68	9	1	\N	.5 teaspoon dried oregano
71	9	1	\N	.5 to .75 cup heavy cream
72	9	1	\N	.5 cup (1.5 ounces) Parmesan
73	9	1	\N	.33 cup sliced sun-dried tomatoes, packed in oil
143	19	44	ct	fish sticks
150	21	1	lb	linguine
151	21	1	lb	small frozen shrimp
157	23	2	packs	of hot dogs
161	24	1	lb	hot or sweet Italian sausages
162	24	1	lb	mixed mushrooms, such as shiitake, oyster, maitake or cremini, trimmed and quartered (or
166	24	1	garlic	clove, coarsely
167	24	4	cups	torn, bite-size pieces of crusty bread (6 to 8 ounces)
168	24	2	cups	arugula
195	28	2	lb	sweet or hot Italian sausages
178	26	2	whole	tomatoes
179	26	8	oz	cheddar block
184	27	1	baguette	(about 20 to 24 inches long)
225	32	1	lb	loose sweet Italian sausage (see Tip)
228	32	1	lb	short pasta (such as macaroni, cavatappi or fusilli)
236	34	2	lb	93% lean ground beef
189	27	8	ounces	sliced ham, preferably smoked or Black Forest
141	3	1		Cheddar cheese
191	28	12	shallots,	trimmed on both ends and (about 6 ounces)
192	28	4	crisp	apples (preferably one tart, like Granny Smith, and one sweet, like Fuji)
142	3	1		Frozen Pancakes
145	19	1		Frozen vegetables
196	28	3	fresh	rosemary sprigs
147	20	1		Chumin
148	20	1		Brussels sprouts
201	29	3	tablespoons	honey
149	20	1		Microwave rice
152	21	1		1 lemon
154	22	1		microwave rice
155	22	1		whole carrots
206	29	1	to	4 chipotles from a can of chipotles in adobo, plus 2 tablespoons adobo sauce
216	31	1	bag	semi-sweet chocolate chips
156	22	1		honey
221	32	1	large	bunch kale, leaves only, coarsely
158	23	1		Potato chips
159	23	1		Salad greens
224	32	2	tablespoons	tomato paste
160	23	1		Melon
227	32	6	cups	low-sodium chicken broth or water
229	32	2	cups/8	ounces shredded sharp Cheddar
171	25	1		12 eggs
174	25	1		fage yogurt
242	35	16	oz	ricotta cheese
243	35	16	oz	sweet italian sausage
244	35	40	oz	prego sauce
245	35	8	oz	shredded mozzarella
246	35	8	oz	shredded parmesan
247	36	2	lemons,	juiced
175	25	1		honey
176	25	1		blueberries
177	25	1		granola
180	26	1		fage yogurt
181	26	1		honey
182	26	1		blueberries
183	26	1		granola
212	30	1		Rotisserie Chicken
257	36	2	pounds	boneless, skinless chicken thighs
258	36	1	large	red onion and quartered
259	36	2	tablespoons	fresh parsley
200	29	1.5	pounds	boneless, skinless chicken thighs
230	32	1.5	teaspoons	hot sauce, plus more to taste
214	30	1		Frozen vegetables
215	31	1		Pancake mix
217	31	1		12 eggs
144	19	1	\N	Kraft Deluxe Macaroni and Cheese
153	22	1	\N	Salmon filet (2-3 lbs)
146	20	1	\N	2-3 lb Boneless pork chops
170	24	1	\N	Finely grated Parmesan, for serving
172	25	1	\N	Lays potato chips
199	28	1	\N	Chopped fresh parsley, for serving (optional)
207	29	1	\N	1(15-ounce) can black beans, rinsed and drained
208	29	1	\N	Juice of 1 lime
209	29	1	\N	Warmed tortillas, for serving
210	29	1	\N	Pickled onion, for serving (see Tip)
211	29	1	\N	Sliced or cubed avocado, for serving
213	30	1	\N	Kraft deluxe macaroni and cheese
235	33	1	\N	microwave brown rice
241	35	1	\N	barilla lasagna noodles
255	36	1	\N	A pinch ground cinnamon
169	24	1	\N	.5 cup coarsely fresh parsley leaves
188	27	1	\N	.33 cup fruit jam or preserves, such as cherry, peach or orange
220	32	1	\N	.5 white onion
328	42	1	lb	lean ground beef
353	44	1	lb	ground beef
273	38	1	to	2 chipotle chiles in adobo (depending on heat tolerance), plus 2 tablespoons adobo sauce
274	38	2	tablespoons	Worcestershire or soy sauce
306	40	1		1 lime
340	42	1		Tzatziki
341	42	1		Pita bread
280	39	1	large	yellow or red onion
282	39	2	pounds	ground beef, 80 percent lean, 20 percent fat
283	39	8	garlic	cloves
329	42	1	\N	.5 lb ground lamb or pork
286	39	2	teaspoons	chipotle powder
284	39	1	\N	1(6-ounce) can tomato paste
296	39	1	\N	1(14-ounce) can or crushed tomatoes in juice
302	39	1	\N	2(14-ounce) cans kidney beans, drained and rinsed
303	39	1	\N	2(14-ounce) cans pinto beans, drained and rinsed
305	39	1	\N	Hot sauce, sharp Cheddar, sliced scallions, sour cream and crushed tortilla chips, for serving
342	43	1	\N	Nonstick cooking spray
298	39	2	tablespoons	maple syrup or dark brown sugar
299	39	2	tablespoons	soy sauce
300	39	2	teaspoons	beef stock bouillon paste, such as Better Than Bouillon
304	39	1	tablespoon	Worcestershire sauce
307	40	4	garlic	cloves, smashed and
308	40	1	cup	dill, mint, parsley or a combination, plus more for serving
358	44	1	\N	1(15-ounce) can black or pinto beans
361	44	1	\N	Hot sauce, for drizzling (optional)
312	40	2	pounds	ground lamb, beef, turkey or a combination
313	40	3	pints	cherry or Sungold tomatoes (about 30 ounces)
292	39	1	\N	.5 teaspoon cayenne powder
293	39	1	\N	.5 teaspoon ground cinnamon
294	39	1	\N	.25 teaspoon ground cloves
327	42	1	medium	tomato (about 5 ounces)
331	42	1	large	egg, lightly beaten
309	40	1	\N	.5 cup full-fat Greek yogurt (about 4 ounces)
335	42	1	teaspoon	dried oregano
336	42	1	teaspoon	ground coriander
326	42	1	\N	.5 cup (lightly packed) red or yellow onion (from about .5 large onion)
330	42	1	\N	.5 cup panko bread crumbs
332	42	1	\N	.33 cup fresh mint
343	43	1	large	egg
345	43	1	medium	apple, cored and (6 ounces)
346	43	1	small	yellow onion (1 cup)
348	43	2	teaspoons	Worcestershire sauce
333	42	1	\N	.33 cup fresh parsley
347	43	1	\N	.75 cup seasoned panko bread crumbs
357	44	1	\N	.5 teaspoon dried oregano
352	43	1	teaspoon	Italian seasoning (optional)
354	44	1	medium	yellow or white onion
359	44	1	large	tomato, coarsely
362	44	6	burrito-size	(about 10-inch) flour tortillas
363	44	2	cups	(8 ounces) shredded Monterey Jack or Mexican blend cheese
364	45	3	tablespoons	mayonnaise
366	45	8	slices	white bread
272	38	1.5	cups	tomato-based barbecue sauce
276	38	1.5	to	2 pounds boneless, skinless chicken thighs
277	38	1.5	to	2 pounds boneless, skinless chicken breasts
295	39	12	ounces	(1.5 cups) pilsner beer, such as Modelo Especial
301	39	1.5	teaspoons	unsweetened cocoa powder
344	43	1.5	pounds	ground turkey (90 percent lean)
368	45	6	ounces	thinly sliced cooked ham
369	45	6	ounces	thinly sliced deli turkey
370	45	3	large	eggs, lightly beaten
408	50	1	lb	spaghetti
415	50	1	lb	ground beef (at least 85-percent lean)
374	45	1		Raspberry Jam
20	4	1	\N	red wine vinegar
22	4	1	\N	pepper
38	6	1	\N	balsamic vinegar
392	48	1	hard-boiled	egg
393	48	1	celery	rib, finely
395	48	2	tablespoons	finely red onion, shallot or scallions
396	48	2	tablespoons	finely fresh parsley, chives, tarragon or a mix (optional)
397	48	2	tablespoons	mayonnaise, plus more for spreading (see Tip)
398	48	1	tablespoon	sweet pickle relish or dill pickles (optional)
399	48	2	teaspoons	freshly squeezed lemon juice
56	8	1	\N	olive oil
402	48	4	slices	thick, soft sandwich bread, such as Texas toast, toasted, if desired
403	48	2	lettuce	leaves, such as iceberg, romaine, green leaf or Bibb
404	49	8	inch	flour tortillas
405	49	2	bags	shredded mexican cheese
57	8	1	\N	salt
58	8	1	\N	pepper
410	50	1	large	yellow onion
62	9	1	\N	(such as Diamond Crystal) and black pepper
64	9	1	\N	olive oil
420	50	1	large	egg
421	50	2	cups/8	ounces shredded low-moisture mozzarella
412	50	1		fresh thyme
418	50	8	oz	ricotta cheese
43	7	1	pack	Pepperjack Cheese
373	45	1	\N	Confectioners’ sugar, for serving
388	47	8	slices	sandwich bread, no more than .5-inch thick
413	50	1.5	teaspoons	dried oregano, plus more for serving
65	9	1	\N	salt
75	9	1	\N	garlic
79	10	1	\N	garlic
85	10	1	\N	salt
86	10	1	\N	pepper
87	10	1	\N	canned chipotle pepper (optional)
89	10	1	\N	chili powder
102	12	1	\N	garlic
367	45	1	\N	.5 lb thinly sliced Swiss cheese
391	48	1	\N	1(5-ounce) can solid white albacore or skipjack tuna (see Tip)
400	48	1	\N	A few large handfuls of hearty potato chips or corn chips (see Tip)
406	50	1	\N	Unsalted butter, for greasing the pan
416	50	1	\N	1(32- to 35-ounce) jar marinara sauce
390	47	1	\N	.5 cup (about 2 ounces) hard cheese, such as Parmesan, Asiago or Gruyère (or more sharp Cheddar)
417	50	1	\N	.5 cup fresh basil or parsley leaves, plus more for serving
419	50	1	\N	.75 cup Parmesan
289	39	1	\N	onion powder
290	39	1	\N	mustard
291	39	1	\N	paprika
297	39	1	\N	cider vinegar
310	40	1	\N	paprika
311	40	1	\N	(Diamond Crystal) and black pepper
334	42	1	\N	garlic
337	42	1	\N	cumin
338	42	1	\N	pepper
339	42	1	\N	olive oil
349	43	1	\N	garlic powder
350	43	1	\N	salt
351	43	1	\N	pepper
355	44	1	\N	cumin
356	44	1	\N	paprika
360	44	1	\N	lime juice
365	45	1	\N	mustard
371	45	1	\N	salt
372	45	1	\N	salt
387	47	1	\N	salt
389	47	1	\N	pepper
394	48	1	\N	olive oil
401	48	1	\N	pepper
407	50	1	\N	(such as Diamond Crystal) and black pepper
409	50	1	\N	olive oil
411	50	1	\N	garlic
414	50	1	\N	pepper
\.


--
-- Data for Name: meals; Type: TABLE DATA; Schema: public; Owner: mealuser
--

COPY public.meals (id, meal_name, relative_effort, last_planned, red_meat, url) FROM stdin;
6	Pork tenderloin with blackberry balsamic glaze, veg, and rolls/rice/bread	4	2025-01-26 09:57:54.30442	t	\N
8	Tuna Salad sandwiches	4	2024-11-03 00:00:00	f	\N
9	Marry Me Chicken, naan, fruit	10	2024-11-03 00:00:00	f	\N
10	Fish Tacos, tortilla chips, salsa	4	2024-11-24 00:00:00	f	\N
12	Spaghetti	3	2024-11-03 00:00:00	f	\N
14	Waffles, sausage	1	2024-11-03 00:00:00	f	\N
15	Pork chops with peach preserves and Whole Grain Mustard, veg, and rolls/rice/bread	4	2025-01-09 00:00:00	t	\N
17	Steak with chimichurri (NYT), rice, salad	6	2024-11-24 00:00:00	t	\N
18	Garlic linguine	3	2024-12-01 00:00:00	f	\N
19	Fish sticks, Mac, Veg	1	2025-01-09 00:00:00	f	\N
20	Sheet Pan cumin pork chops w/ brussels sprouts	3	2024-11-03 00:00:00	t	\N
28	Sheet Pan sausage with apples, parfait (NYT)	3	2025-02-02 00:00:00	f	\N
32	Cheesy stovetop Mac with sausage and kale (NYT)	5	2025-01-20 13:39:53.075682	f	\N
34	Beef Burgers plain, salad, chips	4	2025-01-09 00:00:00	t	\N
39	Slow Cooker Chili (NYT)	3	2025-01-09 00:00:00	f	\N
40	Slow-Cooker Kofte in Tomato-Lime Broth (NYT)	4	2025-01-09 00:00:00	f	\N
42	Greek Meatballs (NYT)	5	2025-01-26 09:57:54.30442	f	\N
44	Easy Burritos (NYT)	4	2025-02-02 00:00:00	f	\N
45	Monte Cristo Sandwich (NYT)	3	2025-02-02 00:00:00	f	\N
47	Sheet-Pan Grilled Cheese (NYT)	2	2024-11-24 00:00:00	f	\N
48	Tuna Crunch Sandwiches (NYT)	3	2024-11-17 00:00:00	f	\N
4	Chicken Salad sandwiches (NYT)	4	2025-03-02 14:14:20.423248	f	\N
11	Steak, potatoes	4	2025-03-02 14:14:20.423248	t	\N
13	Chicken nuggets, mac and cheese, veg	1	2025-03-02 14:14:20.423248	f	\N
50	Baked Spaghetti (NYT)	4	2025-04-21 00:07:57.103037	f	\N
26	Tomato cheddar toasts, parfait	1	2025-04-21 00:11:53.992991	f	\N
30	Rotisserie Chicken, Mac, Veg	2	2025-04-21 00:11:53.992991	f	\N
3	Banana pancakes, eggs, bacon	2	2025-03-09 13:25:14.132952	f	\N
7	Apple Cheddar Chicken Burgers, salad, chips	4	2025-03-09 13:25:14.132952	t	\N
27	Ham and jam sandwiches	2	2025-04-21 00:11:53.992991	t	\N
35	Lasagna	4	2025-03-09 13:25:14.132952	f	\N
2	Tortellini, rotisserie chicken, fruit	1	2025-03-16 12:57:50.03018	f	\N
49	Crispy-Edged Quesadilla (NYT)	2	2025-04-21 00:11:53.992991	f	\N
24	Sheet pan peppers, bread, and arugula with vinaigrette (NYT cooking)	3	2025-03-16 12:57:50.03018	f	\N
25	Potato chip Frittata, salad, parfait	4	2025-03-16 12:57:50.03018	f	\N
38	Slow-Cooker BBQ Pulled Chicken (NYT)	4	2025-03-16 12:57:50.03018	f	\N
52	Frozen Pizza	1	2025-03-16 12:57:50.03018	f	
1	Ham and cheese buns (NYT)	2	2025-03-29 13:07:56.402062	t	\N
5	Beef Tacos, tortilla chips	3	2025-03-29 13:07:56.402062	t	\N
33	Pork tenderloin with fig preserves and Whole Grain Mustard, veg, and rolls/rice/bread	6	2025-03-29 13:07:56.402062	t	\N
43	Easy Turkey Meatloaf (NYT)	2	2025-03-29 13:07:56.402062	f	\N
23	Hot dogs, salad, chips	1	2025-03-29 13:07:56.402062	f	\N
21	Linguine with shrimp and lemon (NYT)	3	2025-03-29 13:07:56.402062	f	\N
29	Slow cooker chipotle-honey chicken tacos (NYT)	4	2025-04-06 12:53:48.674852	f	\N
31	Chocolate chip pancakes, eggs, sausage	2	2025-04-06 12:53:48.674852	f	\N
36	Oven roasted shawarma, pita, yogurt sauce	6	2025-04-06 12:53:48.674852	f	\N
22	Salmon, rice, roasted carrots	3	2025-04-06 12:53:48.674852	f	\N
51	Pepperoni Pizza Rolls	3	2025-04-21 00:11:53.992991	f	https://www.allthingsmamma.com/pepperoni-rolls/
16	Beef Burgers with feta, salad, chips	4	2025-04-21 00:11:53.992991	t	\N
\.


--
-- Data for Name: recipe_steps; Type: TABLE DATA; Schema: public; Owner: mealuser
--

COPY public.recipe_steps (id, meal_id, step_number, instruction, created_at) FROM stdin;
1	51	1	Preheat oven to 450 degrees F.	2025-03-02 14:08:46.572456
2	51	2	Spread pizza dough out on a cutting board and Cut the dough into 10 equal-size rectangles ( a pizza cutter makes this job easier)	2025-03-02 14:08:46.572456
3	51	3	Arrange 4 pepperoni slices on each rectangle and top with a mozzarella cheese stick.	2025-03-02 14:08:46.572456
4	51	4	Roll up the pizza dough, enclosing the cheese stick, pinching the seams closed.	2025-03-02 14:08:46.572456
5	51	5	Melt the butter and stir in the parmesan cheese.	2025-03-02 14:08:46.572456
6	51	6	Brush the pizza sticks with the melted butter mixture.	2025-03-02 14:08:46.572456
7	51	7	Bake for 10 to 12 minutes or until golden brown.	2025-03-02 14:08:46.572456
\.


--
-- Name: ingredients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mealuser
--

SELECT pg_catalog.setval('public.ingredients_id_seq', 429, true);


--
-- Name: meals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mealuser
--

SELECT pg_catalog.setval('public.meals_id_seq', 52, true);


--
-- Name: recipe_steps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mealuser
--

SELECT pg_catalog.setval('public.recipe_steps_id_seq', 7, true);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: meals meals_pkey; Type: CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);


--
-- Name: recipe_steps recipe_steps_meal_id_step_number_key; Type: CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_meal_id_step_number_key UNIQUE (meal_id, step_number);


--
-- Name: recipe_steps recipe_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals(id) ON DELETE CASCADE;


--
-- Name: recipe_steps recipe_steps_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mealuser
--

ALTER TABLE ONLY public.recipe_steps
    ADD CONSTRAINT recipe_steps_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

