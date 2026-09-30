import React, {useMemo} from 'react';
import type {CSSProperties} from 'react';
import {
	AbsoluteFill,
	Easing,
	Sequence,
	continueRender,
	delayRender,
	interpolate,
	random,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

/* ------------------------------------------------------------------ */
/* Composition constants                                               */
/* ------------------------------------------------------------------ */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scenes overlap by XFADE frames so every cut is a cross-dissolve.
const XFADE = 12;
const SCENES = {
	opening: {from: 0, duration: 135},
	search: {from: 123, duration: 135},
	ai: {from: 246, duration: 135},
	// Phone -> estimate request -> local map -> end card is one continuous move.
	finale: {from: 369, duration: 420},
} as const;

export const DURATION_IN_FRAMES = SCENES.finale.from + SCENES.finale.duration; // 789, about 26s

// Finale beats, in frames from the start of the finale.
const FIN = {
	tap: 50, // customer taps "Request estimate"
	pushStart: 110, // camera starts pushing into the phone's map
	pushEnd: 130, // map fills the frame; hand-off to the full-screen map
	pullEnd: 205, // pull-back over the neighbourhood settles
	mapCopy: 150, // "Understand how customers find you."
	inquiries: 175, // inquiry cards arrive
	endCard: 270, // end card, which then holds for 5 seconds
} as const;

// Background loop: a separate 12-second cut with no copy.
export const BG_LOOP_FRAMES = 12 * FPS;

// Local map: the phone's map is the same render, so the push-in cut is seamless.
const PHONE_MAP_W = 332;
const PHONE_MAP_H = 220;
const MAP_ZOOM = 3.2; // full-screen zoom at the hand-off
const PUSH_SCALE = WIDTH / PHONE_MAP_W;
const UI_BOOST = 2.2; // pin and icon size multiplier inside the phone

// Navy, white and orange throughout. Orange is the brand red from public/styles.css.
const C = {
	ink: '#11100f',
	paper: '#fbfaf6',
	muted: '#c3cbe0', // supporting copy, bright enough to read on navy
	dim: '#8f9ab8',
	orange: '#e2462f',
	orangeSoft: '#ff8a3d',
	line: 'rgba(255,255,255,0.12)',
	navy: '#141d38',
	navyDeep: '#0e1530',
	navyPanel: '#1b2649',
};

const FONT = 'Archivo, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, "DejaVu Sans Mono", monospace';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type SeoAnimationProps = {
	hook: string;
	hookAccent: string;
	hookSub: string;
	openingQueries: string[];
	search: string;
	searchAccent: string;
	searchSub: string;
	searchQuery: string;
	aiHeadline: string;
	aiAccent: string;
	aiPrompt: string;
	phoneHeadline: string;
	phoneAccent: string;
	phoneQuery: string;
	mapHeadline: string;
	mapSub: string;
	businessName: string;
	businessDomain: string;
	brandName: string;
	ctaHeadline: string;
	ctaAccent: string;
	ctaSub: string;
	ctaButton: string;
	url: string;
};

export const defaultSeoProps: SeoAnimationProps = {
	hook: 'Your next customer is searching.',
	hookAccent: 'searching.',
	hookSub: 'Give them a reason to choose you.',
	openingQueries: [
		'hardwood floor installers',
		'floor refinishing cost',
		'who installs herringbone floors',
		'flooring contractor near me',
	],
	search: 'We get you found.',
	searchAccent: 'found.',
	searchSub: 'Clear pages that search engines understand and customers trust.',
	searchQuery: 'hardwood floor installers',
	aiHeadline: 'Build visibility across search, Maps, and AI answers.',
	aiAccent: 'AI answers.',
	aiPrompt: 'Who should I hire to install hardwood floors?',
	phoneHeadline: 'Turn searches into inquiries.',
	phoneAccent: 'inquiries.',
	phoneQuery: 'flooring contractor near me',
	mapHeadline: 'Understand how customers find you.',
	mapSub: 'Track the inquiries that follow.',
	businessName: 'Your Business',
	businessDomain: 'yourbusiness.com',
	brandName: 'Burnworth Co',
	ctaHeadline: 'Get your free visibility review.',
	ctaAccent: 'review.',
	ctaSub: 'See where your business appears, what may be holding it back, and which improvements to prioritize.',
	ctaButton: 'Get my visibility review',
	url: 'burnworthco.com',
};

/* ------------------------------------------------------------------ */
/* Font: the same Archivo file the site ships, loaded from public/.    */
/* If the file is missing, rendering continues on the fallback stack.  */
/* ------------------------------------------------------------------ */

if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
	const handle = delayRender('Loading Archivo');
	const face = new FontFace(
		'Archivo',
		`url(${staticFile('archivo-latin.woff2')}) format('woff2')`,
		{weight: '400 700'},
	);
	face
		.load()
		.then(() => {
			document.fonts.add(face);
			continueRender(handle);
		})
		.catch(() => continueRender(handle));
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

const useSpring = (delay: number, config?: Parameters<typeof spring>[0]['config']) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return spring({frame: frame - delay, fps, config: {damping: 200, ...config}});
};

const typed = (text: string, frame: number, start: number, end: number) =>
	text.slice(0, Math.round(interpolate(frame, [start, end], [0, text.length], clamp)));

const Cursor: React.FC<{color?: string; height?: number}> = ({color = C.orange, height = 34}) => {
	const frame = useCurrentFrame();
	return (
		<span
			style={{
				display: 'inline-block',
				width: 3,
				height,
				marginLeft: 4,
				background: color,
				opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
				verticalAlign: 'middle',
			}}
		/>
	);
};

/* Word-by-word masked slide-up, with optional accent words. */
const Words: React.FC<{
	text: string;
	start: number;
	stagger?: number;
	accent?: string;
	accentColor?: string;
	style?: CSSProperties;
}> = ({text, start, stagger = 3, accent = '', accentColor = C.orange, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const accents = new Set(accent.toLowerCase().split(/\s+/).filter(Boolean));
	return (
		<div style={style}>
			{text.split(' ').map((word, i) => {
				const s = spring({
					frame: frame - start - i * stagger,
					fps,
					config: {damping: 16, stiffness: 150, mass: 0.8},
				});
				const isAccent = accents.has(word.toLowerCase());
				return (
					<span
						key={`${word}-${i}`}
						style={{
							display: 'inline-block',
							overflow: frame - start - i * stagger > 24 ? 'visible' : 'hidden',
							verticalAlign: 'top',
							padding: '0.08em 0 0.14em',
							margin: '-0.08em 0.22em -0.14em 0',
						}}
					>
						<span
							style={{
								display: 'inline-block',
								transform: `translateY(${interpolate(s, [0, 1], [110, 0])}%) rotate(${(1 - s) * 7}deg)`,
								transformOrigin: 'left bottom',
								color: isAccent ? accentColor : undefined,
							}}
						>
							{word}
						</span>
					</span>
				);
			})}
		</div>
	);
};

const FadeUp: React.FC<{delay: number; style?: CSSProperties; children: React.ReactNode}> = ({delay, style, children}) => {
	const s = useSpring(delay);
	return <div style={{...style, opacity: s, transform: `translateY(${(1 - s) * 24}px)`}}>{children}</div>;
};

const Panel: React.FC<{style?: CSSProperties; children: React.ReactNode}> = ({style, children}) => (
	<div
		style={{
			position: 'absolute',
			borderRadius: 28,
			background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
			border: `1px solid ${C.line}`,
			boxShadow: '0 40px 100px rgba(5,10,30,0.45)',
			...style,
		}}
	>
		{children}
	</div>
);

const SearchIcon: React.FC<{size?: number; color?: string}> = ({size = 30, color = C.dim}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
		<circle cx="10.5" cy="10.5" r="6.5" />
		<line x1="15.5" y1="15.5" x2="21" y2="21" />
	</svg>
);

const headline: CSSProperties = {
	fontFamily: FONT,
	fontWeight: 700,
	fontSize: 112,
	lineHeight: 1.0,
	letterSpacing: '-0.035em',
	color: C.paper,
};

const subline: CSSProperties = {
	fontFamily: FONT,
	fontWeight: 400,
	fontSize: 40,
	lineHeight: 1.3,
	color: C.muted,
};

/* ------------------------------------------------------------------ */
/* Scene wrapper: blur/scale cross-dissolve in and out                 */
/* ------------------------------------------------------------------ */

const SceneFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
	const frame = useCurrentFrame();
	const inP = interpolate(frame, [0, XFADE], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const outP = interpolate(frame, [duration - XFADE, duration], [1, 0], {
		...clamp,
		easing: Easing.in(Easing.cubic),
	});
	const blur = (1 - inP) * 10 + (1 - outP) * 10;
	const scale = interpolate(inP, [0, 1], [0.97, 1]) * interpolate(outP, [0, 1], [1.04, 1]);
	return (
		<AbsoluteFill
			style={{
				opacity: Math.min(inP, outP),
				transform: `scale(${scale})`,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Background: quiet navy with a slow blue glow and a warm corner      */
/* ------------------------------------------------------------------ */

const Backdrop: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse 60% 55% at ${24 + 5 * Math.sin(frame / 90)}% ${22 + 4 * Math.cos(frame / 70)}%, rgba(58,98,220,0.28), transparent 70%),
					radial-gradient(ellipse 50% 45% at 84% 86%, rgba(255,138,61,0.10), transparent 70%),
					linear-gradient(160deg, ${C.navy}, ${C.navyDeep})`,
			}}
		/>
	);
};

const Grain: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<svg width="100%" height="100%" style={{opacity: 0.06, mixBlendMode: 'overlay'}}>
				<filter id="grain">
					<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 8} />
				</filter>
				<rect width="100%" height="100%" filter="url(#grain)" />
			</svg>
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, rgba(6,10,26,0.3) 100%)'}}
			/>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 1 - Opportunity: your next customer is searching              */
/* ------------------------------------------------------------------ */

const OpeningScene: React.FC<{hook: string; accent: string; sub: string; queries: string[]}> = ({
	hook,
	accent,
	sub,
	queries,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const drift = frame * 0.25;
	const focus = useSpring(84, {damping: 20});
	const last = queries.length - 1;

	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 140, top: 300, width: 860}}>
				<Words text={hook} accent={accent} start={6} stagger={4} style={headline} />
				<FadeUp delay={36} style={{...subline, marginTop: 40}}>
					{sub}
				</FadeUp>
			</div>

			{/* the searches customers are typing right now */}
			<div style={{position: 'absolute', left: 1090, top: 300 - drift, width: 700}}>
				{queries.map((q, i) => {
					const s = spring({frame: frame - 18 - i * 12, fps, config: {damping: 18, stiffness: 110}});
					const isFocus = i === last;
					const text = isFocus ? typed(q, frame, 56, 80) : q;
					return (
						<div
							key={q}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 18,
								height: 86,
								padding: '0 30px',
								marginBottom: 20,
								borderRadius: 43,
								background: isFocus ? `rgba(255,255,255,${0.06 + 0.06 * focus})` : 'rgba(255,255,255,0.05)',
								border: isFocus ? `2px solid rgba(226,70,47,${0.25 + 0.75 * focus})` : `1px solid ${C.line}`,
								boxShadow: isFocus ? `0 16px 50px rgba(226,70,47,${0.25 * focus})` : undefined,
								fontFamily: FONT,
								fontSize: 30,
								color: isFocus ? C.paper : C.muted,
								opacity: s * (isFocus ? 1 : 0.8),
								transform: `translateY(${(1 - s) * 40}px) scale(${isFocus ? 1 + 0.03 * focus : 1})`,
								transformOrigin: 'left center',
							}}
						>
							<SearchIcon size={28} color={isFocus ? C.orange : C.dim} />
							<span>{text}</span>
							{isFocus && frame < 90 ? <Cursor height={30} /> : null}
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 2 - Found in search                                           */
/* ------------------------------------------------------------------ */

const SearchScene: React.FC<{
	headlineText: string;
	accent: string;
	sub: string;
	query: string;
	business: string;
	domain: string;
}> = ({headlineText, accent, sub, query, business, domain}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const panel = useSpring(4, {damping: 18, stiffness: 90});
	const text = typed(query, frame, 12, 36);
	const rise = spring({frame: frame - 44, fps, config: {damping: 16, stiffness: 80}});
	const yourRowIn = useSpring(30);
	const ROW = 104;

	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 140, top: 330, width: 820}}>
				<Words text={headlineText} start={6} stagger={4} accent={accent} style={headline} />
				<FadeUp delay={26} style={{...subline, marginTop: 40, maxWidth: 720}}>
					{sub}
				</FadeUp>
			</div>

			<div
				style={{
					position: 'absolute',
					left: 1030,
					top: 250,
					width: 760,
					opacity: panel,
					transform: `translateY(${(1 - panel) * 60}px)`,
				}}
			>
				<div
					style={{
						height: 96,
						borderRadius: 48,
						background: C.navyPanel,
						border: `2px solid rgba(226,70,47,0.7)`,
						boxShadow: '0 20px 60px rgba(5,10,30,0.4)',
						display: 'flex',
						alignItems: 'center',
						gap: 20,
						padding: '0 34px',
						fontFamily: FONT,
						fontSize: 34,
						color: C.paper,
					}}
				>
					<SearchIcon />
					<span>{text}</span>
					{frame < 44 ? <Cursor /> : null}
				</div>

				{/* your listing climbs to the top */}
				<div style={{position: 'relative', height: ROW * 4, marginTop: 34}}>
					{[0, 1, 2].map((i) => {
						const s = spring({frame: frame - 30 - i * 3, fps, config: {damping: 200}});
						return (
							<div
								key={i}
								style={{
									position: 'absolute',
									left: 0,
									right: 0,
									top: (i + rise) * ROW,
									height: ROW - 18,
									borderRadius: 18,
									border: `1px solid ${C.line}`,
									background: 'rgba(255,255,255,0.04)',
									padding: '22px 28px',
									boxSizing: 'border-box',
									opacity: s * (1 - 0.4 * rise),
								}}
							>
								<div style={{width: 200 + i * 40, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.18)'}} />
								<div style={{width: 400 - i * 50, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.09)', marginTop: 14}} />
							</div>
						);
					})}
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							top: (3 - 3 * rise) * ROW,
							height: ROW - 18,
							borderRadius: 18,
							background: C.paper,
							boxShadow: `0 20px 60px rgba(5,10,30,${0.2 + 0.3 * rise})`,
							padding: '0 28px',
							boxSizing: 'border-box',
							display: 'flex',
							alignItems: 'center',
							gap: 20,
							opacity: yourRowIn,
							zIndex: 2,
						}}
					>
						<div style={{width: 18, height: 18, background: C.orange, flexShrink: 0}} />
						<div>
							<div style={{fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.ink}}>{business}</div>
							<div style={{fontFamily: FONT, fontSize: 22, color: '#5d6378', marginTop: 2}}>{domain}</div>
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 3 - Visibility across search, Maps and AI answers             */
/* ------------------------------------------------------------------ */

const Sparkle: React.FC<{size: number; rotate: number}> = ({size, rotate}) => (
	<svg width={size} height={size} viewBox="-12 -12 24 24" style={{transform: `rotate(${rotate}deg)`}}>
		<path d="M0 -11 C1.2 -3 3 -1.2 11 0 C3 1.2 1.2 3 0 11 C-1.2 3 -3 1.2 -11 0 C-3 -1.2 -1.2 -3 0 -11 Z" fill={C.orangeSoft} />
	</svg>
);

const AiScene: React.FC<{headlineText: string; accent: string; prompt: string; business: string; domain: string}> = ({
	headlineText,
	accent,
	prompt,
	business,
	domain,
}) => {
	const frame = useCurrentFrame();
	const panel = useSpring(2, {damping: 18, stiffness: 90});
	const promptText = typed(prompt, frame, 10, 32);
	const answer = useSpring(34);
	const mention = useSpring(50);
	const link = useSpring(60);

	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 140, top: 290, width: 840}}>
				<Words text={headlineText} start={4} stagger={3} accent={accent} style={{...headline, fontSize: 96}} />
			</div>

			<Panel
				style={{
					left: 1040,
					top: 250,
					width: 740,
					padding: 40,
					opacity: panel,
					transform: `translateY(${(1 - panel) * 60}px)`,
				}}
			>
				<div style={{display: 'flex', justifyContent: 'flex-end'}}>
					<div
						style={{
							maxWidth: 560,
							background: 'rgba(255,255,255,0.12)',
							borderRadius: '26px 26px 6px 26px',
							padding: '20px 26px',
							fontFamily: FONT,
							fontSize: 30,
							lineHeight: 1.3,
							color: C.paper,
							minHeight: 40,
						}}
					>
						{promptText}
						{frame < 36 ? <Cursor height={30} color={C.paper} /> : null}
					</div>
				</div>

				<div style={{display: 'flex', gap: 20, marginTop: 40, opacity: answer}}>
					<div style={{flexShrink: 0, marginTop: 4}}>
						<Sparkle size={40} rotate={frame * 2} />
					</div>
					<div style={{flex: 1}}>
						<div
							style={{
								fontFamily: FONT,
								fontSize: 32,
								lineHeight: 1.4,
								color: C.paper,
							}}
						>
							One local option is{' '}
							<span
								style={{
									fontWeight: 700,
									background: `rgba(226,70,47,${0.35 * mention})`,
									borderRadius: 8,
									padding: '0 8px',
								}}
							>
								{business}
							</span>
							.
						</div>
						<div
							style={{
								marginTop: 28,
								display: 'flex',
								alignItems: 'center',
								gap: 14,
								fontFamily: FONT,
								fontSize: 26,
								color: C.muted,
								opacity: link,
								transform: `translateY(${(1 - link) * 16}px)`,
							}}
						>
							<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={C.orangeSoft} strokeWidth={2.2} strokeLinecap="round">
								<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
								<path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
							</svg>
							{domain}
						</div>
					</div>
				</div>
			</Panel>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Local map: navy blocks, white streets, orange searchers             */
/* ------------------------------------------------------------------ */

const BLOCK = 120; // world units between streets
const EXTENT = 3600;

type Agent = {path: Pt[]; len: number; speed: number; phase: number; cycles: number};

const AGENTS: Agent[] = Array.from({length: 22}, (_, i) => {
	const ax = Math.round((random(`ax-${i}`) - 0.5) * 26) || 4;
	const by = Math.round((random(`by-${i}`) - 0.5) * 26) || -5;
	const start: Pt = [ax * BLOCK, by * BLOCK];
	const mid: Pt = random(`hf-${i}`) > 0.5 ? [0, by * BLOCK] : [ax * BLOCK, 0];
	return {
		path: [start, mid, [0, 0]],
		len: (Math.abs(ax) + Math.abs(by)) * BLOCK,
		speed: 16 + random(`sp-${i}`) * 16,
		phase: random(`ph-${i}`),
		cycles: 1 + (i % 2),
	};
});

const posAt = (a: Agent, d: number): Pt => {
	let rest = Math.max(0, d);
	for (let i = 0; i < a.path.length - 1; i++) {
		const [x0, y0] = a.path[i];
		const [x1, y1] = a.path[i + 1];
		const seg = Math.abs(x1 - x0) + Math.abs(y1 - y0);
		if (rest <= seg || i === a.path.length - 2) {
			const k = seg === 0 ? 1 : Math.min(1, rest / seg);
			return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
		}
		rest -= seg;
	}
	return a.path[a.path.length - 1];
};

const BUILDINGS = (() => {
	const out: {x: number; y: number; w: number; h: number}[] = [];
	for (let bx = -9; bx < 9; bx++) {
		for (let by = -9; by < 9; by++) {
			const n = 2 + Math.floor(random(`bn-${bx}-${by}`) * 3);
			for (let k = 0; k < n; k++) {
				const r = (key: string) => random(`b-${bx}-${by}-${k}-${key}`);
				const w = 22 + r('w') * 38;
				const h = 22 + r('h') * 38;
				out.push({x: bx * BLOCK + 14 + r('x') * (BLOCK - 28 - w), y: by * BLOCK + 14 + r('y') * (BLOCK - 28 - h), w, h});
			}
		}
	}
	return out;
})();

const LocalMap: React.FC<{
	width: number;
	height: number;
	zoom: number; // screen px per world unit
	time: number; // frame clock shared by the phone and full-screen versions
	uiScale: number; // size of pin and phone icons
	cam?: Pt; // world point at the centre of the view
	loop?: number; // when set, searcher motion repeats exactly every `loop` frames
	pinDrop?: number;
	labels?: number; // override for street names and the business chip
	business: string;
}> = ({width, height, zoom, time, uiScale, cam = [0, 0], loop, pinDrop = 1, labels, business}) => {
	const cx = width / 2;
	const cy = height / 2;
	const toScreen = ([x, y]: Pt): Pt => [cx + (x - cam[0]) * zoom, cy + (y - cam[1]) * zoom];
	const lines = Array.from({length: (EXTENT / BLOCK) * 2 + 1}, (_, i) => -EXTENT + i * BLOCK);
	const iconAlpha = interpolate(zoom, [0.18, 0.5], [0, 1], clamp);
	const pulse = (time % 24) / 24;
	const labelAlpha = labels ?? interpolate(zoom, [0.9, 1.8], [0, 1], clamp);
	const dist = (a: Agent) =>
		loop ? (((time / loop) * a.cycles + a.phase) % 1) * a.len : (time * a.speed + a.phase * a.len) % a.len;
	const [px, py] = toScreen([0, 0]);

	return (
		<svg width={width} height={height} style={{display: 'block', background: '#16203f'}}>
			<g transform={`translate(${cx} ${cy}) scale(${zoom}) translate(${-cam[0]} ${-cam[1]})`}>
				<rect x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} fill="#18234a" />
				<path
					d={`M ${-EXTENT} ${-900} C ${-1800} ${-400}, ${-900} ${-1500}, 0 ${-1080} S ${1800} ${-300}, ${EXTENT} ${-1300}`}
					stroke="#101a3a"
					strokeWidth={150}
					fill="none"
				/>
				<rect x={2 * BLOCK} y={1 * BLOCK} width={2 * BLOCK} height={BLOCK} fill="#1f2d5a" />
				<rect x={-6 * BLOCK} y={3 * BLOCK} width={BLOCK * 3} height={BLOCK * 2} fill="#1f2d5a" />
				<rect x={-3 * BLOCK} y={-6 * BLOCK} width={BLOCK} height={BLOCK * 2} fill="#1f2d5a" />
				{BUILDINGS.map((b, i) => (
					<rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill="#223063" />
				))}
				{lines.map((v) => {
					const major = Math.round(v / BLOCK) % 5 === 0;
					const w = major ? 22 : 10;
					const col = major ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.14)';
					return (
						<g key={v}>
							<line x1={v} y1={-EXTENT} x2={v} y2={EXTENT} stroke={col} strokeWidth={w} />
							<line x1={-EXTENT} y1={v} x2={EXTENT} y2={v} stroke={col} strokeWidth={w} />
						</g>
					);
				})}
				<line x1={-EXTENT} y1={EXTENT * 0.7} x2={EXTENT} y2={-EXTENT * 0.55} stroke="rgba(255,255,255,0.34)" strokeWidth={28} />
				<g opacity={labelAlpha} fontFamily={MONO} fontSize={11} fill="rgba(255,255,255,0.7)" letterSpacing={2}>
					<text x={-BLOCK * 2.6} y={4}>MAIN ST</text>
					<text x={-4} y={BLOCK * 1.3} transform={`rotate(90 -4 ${BLOCK * 1.3})`}>5TH AVE</text>
				</g>
				{AGENTS.map((a, i) => {
					const d = dist(a);
					const pts = [0, 50, 100, 150, 200, 260].map((k) => posAt(a, d - k));
					return (
						<polyline
							key={i}
							points={pts.map((q) => q.join(',')).join(' ')}
							fill="none"
							stroke={C.orangeSoft}
							strokeOpacity={0.85}
							strokeWidth={3 * Math.max(uiScale, 0.5)}
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
						/>
					);
				})}
			</g>

			{/* searchers: phone icons at constant screen size */}
			{AGENTS.map((a, i) => {
				const [x, y] = toScreen(posAt(a, dist(a)));
				if (x < -40 || y < -40 || x > width + 40 || y > height + 40) return null;
				const s = uiScale;
				return (
					<g key={i} transform={`translate(${x} ${y})`}>
						<circle r={3 * Math.max(s, 0.6)} fill={C.orangeSoft} opacity={1 - iconAlpha} />
						<g opacity={iconAlpha}>
							<circle r={22 * s} fill={C.orangeSoft} opacity={0.2} />
							<rect x={-9 * s} y={-15 * s} width={18 * s} height={30 * s} rx={4 * s} fill={C.paper} />
							<rect x={-6.5 * s} y={-11 * s} width={13 * s} height={20 * s} rx={2 * s} fill={C.orange} />
						</g>
					</g>
				);
			})}

			{/* business pin */}
			<g transform={`translate(${px} ${py})`}>
				<circle r={(18 + 60 * pulse) * uiScale} fill="none" stroke={C.orange} strokeWidth={3 * uiScale} opacity={(1 - pulse) * pinDrop} />
				<g transform={`translate(0 ${-(1 - pinDrop) * 90 * uiScale}) scale(${uiScale * 1.6})`} opacity={Math.min(1, pinDrop * 3)}>
					<path d="M0 0 C-14 -18 -16 -24 -16 -30 A16 16 0 1 1 16 -30 C16 -24 14 -18 0 0 Z" fill={C.orange} stroke={C.paper} strokeWidth={1.5} />
					<rect x="-5" y="-35" width="10" height="10" fill={C.paper} />
				</g>
				<g opacity={labelAlpha * pinDrop} transform={`translate(${34 * uiScale} ${-70 * uiScale}) scale(${uiScale})`}>
					<rect x={0} y={-22} width={190} height={40} rx={20} fill={C.paper} />
					<text x={20} y={5} fontFamily={FONT} fontWeight={700} fontSize={19} fill={C.ink}>
						{business}
					</text>
				</g>
			</g>
		</svg>
	);
};

/* ------------------------------------------------------------------ */
/* Phone: search, find the business, request an estimate               */
/* ------------------------------------------------------------------ */

const PhoneInHand: React.FC<{query: string; business: string; push: number; mapTime: number}> = ({
	query,
	business,
	push,
	mapTime,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const rise = spring({frame, fps, config: {damping: 16, stiffness: 70}});
	const text = typed(query, frame, 10, 32);
	const map = useSpring(26);
	const pinDrop = spring({frame: frame - 30, fps, config: {damping: 9, stiffness: 180}});
	const card = spring({frame: frame - 36, fps, config: {damping: 14, stiffness: 120}});
	const tap = interpolate(frame, [FIN.tap, FIN.tap + 12], [0, 1], clamp);
	const press = frame >= FIN.tap && frame < FIN.tap + 6 ? 0.94 : 1;
	const sheet = spring({frame: frame - FIN.tap - 8, fps, config: {damping: 18, stiffness: 120}});
	const check = spring({frame: frame - FIN.tap - 16, fps, config: {damping: 10, stiffness: 180}});

	const skin = 'url(#handSkin)';
	return (
		<div
			style={{
				position: 'absolute',
				left: 1060,
				top: 70,
				width: 700,
				height: 1000,
				transform: `translateY(${(1 - rise) * 700}px) rotate(${interpolate(rise, [0, 1], [-12, -5]) * (1 - push)}deg)`,
				transformOrigin: '50% 100%',
			}}
		>
			<svg width={700} height={1000} style={{position: 'absolute', inset: 0}}>
				<defs>
					<linearGradient id="handSkin" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#2d3552" />
						<stop offset="100%" stopColor="#1a2038" />
					</linearGradient>
				</defs>
				<path d="M250 1000 C250 880 300 800 420 770 C520 745 640 790 700 860 L700 1000 Z" fill={skin} />
			</svg>

			<div
				style={{
					position: 'absolute',
					left: 150,
					top: 80,
					width: 400,
					height: 820,
					borderRadius: 64,
					background: '#0b0d16',
					padding: 14,
					boxShadow: '0 60px 140px rgba(5,10,30,0.6), 0 0 0 2px #2a3150',
				}}
			>
				<div
					style={{
						position: 'relative',
						width: '100%',
						height: '100%',
						borderRadius: 50,
						overflow: 'hidden',
						background: C.paper,
						fontFamily: FONT,
					}}
				>
					<div style={{display: 'flex', justifyContent: 'space-between', height: 40, boxSizing: 'border-box', padding: '20px 30px 0', fontSize: 17, lineHeight: '20px', fontWeight: 600, color: C.ink}}>
						<span>9:41</span>
						<span style={{display: 'flex', gap: 5, alignItems: 'center'}}>
							<span style={{width: 18, height: 10, background: C.ink, borderRadius: 2}} />
							<span style={{width: 24, height: 11, border: `2px solid ${C.ink}`, borderRadius: 3}} />
						</span>
					</div>
					<div style={{position: 'absolute', left: '50%', top: 12, width: 110, height: 32, marginLeft: -55, borderRadius: 20, background: '#0b0d16'}} />

					<div
						style={{
							margin: '28px 20px 0',
							height: 60,
							borderRadius: 30,
							background: '#fff',
							boxShadow: '0 4px 18px rgba(17,16,15,0.12)',
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: '0 20px',
							fontSize: 20,
							whiteSpace: 'nowrap',
							color: C.ink,
						}}
					>
						<SearchIcon size={22} color="#6b665e" />
						<span>{text}</span>
						{frame < 34 ? <Cursor height={24} /> : null}
					</div>

					<div
						style={{
							margin: '18px 20px 0',
							width: PHONE_MAP_W,
							height: PHONE_MAP_H,
							borderRadius: 22 * (1 - push),
							overflow: 'hidden',
							opacity: map,
							transform: `translateY(${(1 - map) * 20}px)`,
						}}
					>
						<LocalMap
							width={PHONE_MAP_W}
							height={PHONE_MAP_H}
							zoom={MAP_ZOOM / PUSH_SCALE}
							time={mapTime}
							uiScale={UI_BOOST / PUSH_SCALE}
							pinDrop={pinDrop}
							labels={push}
							business={business}
						/>
					</div>

					{/* your listing, with the action an owner wants */}
					<div
						style={{
							margin: '16px 20px 0',
							padding: '18px 18px',
							borderRadius: 20,
							background: '#fff',
							borderLeft: `6px solid ${C.orange}`,
							boxShadow: `0 10px 30px rgba(20,29,56,${0.18 * card})`,
							transform: `translateY(${(1 - card) * 40}px)`,
							opacity: card,
						}}
					>
						<div style={{fontSize: 24, fontWeight: 700, color: C.ink}}>{business}</div>
						<div style={{fontSize: 16, color: '#5d6378', marginTop: 4}}>
							<span style={{color: '#1f8f5f', fontWeight: 600}}>Open now</span> · Flooring contractor
						</div>
						<div style={{display: 'flex', gap: 10, marginTop: 14}}>
							<div
								style={{
									flex: 0.7,
									height: 46,
									borderRadius: 23,
									border: '2px solid #d6d9e3',
									color: C.ink,
									fontWeight: 600,
									fontSize: 18,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								Call
							</div>
							<div
								style={{
									position: 'relative',
									flex: 1.3,
									height: 46,
									borderRadius: 23,
									background: C.orange,
									color: C.paper,
									fontWeight: 700,
									fontSize: 18,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									transform: `scale(${press})`,
								}}
							>
								Request estimate
								{tap > 0 && tap < 1 ? (
									<span
										style={{
											position: 'absolute',
											left: '50%',
											top: '50%',
											width: 200,
											height: 200,
											marginLeft: -100,
											marginTop: -100,
											borderRadius: '50%',
											border: `3px solid ${C.orange}`,
											transform: `scale(${0.2 + tap})`,
											opacity: 1 - tap,
										}}
									/>
								) : null}
							</div>
						</div>
					</div>

					{/* confirmation sheet */}
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							bottom: 0,
							height: 250,
							borderRadius: '28px 28px 0 0',
							background: '#fff',
							boxShadow: '0 -16px 40px rgba(20,29,56,0.18)',
							transform: `translateY(${(1 - sheet) * 270}px)`,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							paddingTop: 34,
							boxSizing: 'border-box',
						}}
					>
						<div
							style={{
								width: 64,
								height: 64,
								borderRadius: 32,
								background: C.orange,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								transform: `scale(${check})`,
							}}
						>
							<svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={C.paper} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
								<polyline points="5,12.5 10,17 19,7.5" />
							</svg>
						</div>
						<div style={{fontSize: 26, fontWeight: 700, color: C.ink, marginTop: 18}}>Estimate request sent</div>
						<div style={{fontSize: 17, color: '#5d6378', marginTop: 8}}>{business} has your details.</div>
					</div>
				</div>
			</div>

			<svg width={700} height={1000} style={{position: 'absolute', inset: 0}}>
				{[470, 548, 626].map((y, i) => (
					<rect key={y} x={98 - i * 4} y={y} width={66} height={60} rx={30} fill={skin} />
				))}
				<path d="M600 1000 C590 930 560 860 548 790 C542 752 572 732 596 752 C630 790 660 880 690 1000 Z" fill={skin} />
			</svg>
		</div>
	);
};

/* ------------------------------------------------------------------ */
/* Inquiry cards on the map                                            */
/* ------------------------------------------------------------------ */

const INQUIRIES: [string, string][] = [
	['Estimate request', 'Hardwood installation'],
	['Phone call', 'From Google Maps'],
	['Quote form', 'Floor refinishing'],
];

const InquiryCards: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (
		<div style={{position: 'absolute', right: 120, top: 250, width: 440}}>
			{INQUIRIES.map(([title, detail], i) => {
				const s = spring({frame: frame - i * 16, fps, config: {damping: 16, stiffness: 130}});
				return (
					<div
						key={title}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 18,
							padding: '20px 24px',
							marginBottom: 18,
							borderRadius: 20,
							background: C.paper,
							boxShadow: '0 20px 50px rgba(5,10,30,0.35)',
							opacity: s,
							transform: `translateX(${(1 - s) * 80}px)`,
							fontFamily: FONT,
						}}
					>
						<div style={{width: 14, height: 14, background: C.orange, flexShrink: 0}} />
						<div>
							<div style={{fontSize: 26, fontWeight: 700, color: C.ink}}>{title}</div>
							<div style={{fontSize: 20, color: '#5d6378', marginTop: 2}}>{detail}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

/* ------------------------------------------------------------------ */
/* End card: quiet brand background, one clear offer                   */
/* ------------------------------------------------------------------ */

const EndCard: React.FC<{p: SeoAnimationProps}> = ({p}) => {
	const frame = useCurrentFrame();
	const mark = useSpring(0);
	const btn = useSpring(34, {damping: 16, stiffness: 120});
	const breathe = 1 + 0.015 * Math.sin((frame - 34) / 8) * interpolate(frame, [44, 56], [0, 1], clamp);
	const sheen = interpolate((((frame - 60) % 90) + 90) % 90, [0, 40], [-200, 900], clamp);

	return (
		<AbsoluteFill style={{alignItems: 'center'}}>
			{/* faint street grid echoing the map */}
			<AbsoluteFill
				style={{
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.05) 2px, transparent 2px)',
					backgroundSize: '120px 120px',
					backgroundPosition: `${frame * 0.2}px ${frame * 0.1}px`,
					maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 10%, transparent 80%)',
					WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 10%, transparent 80%)',
				}}
			/>

			<div
				style={{
					marginTop: 250,
					fontFamily: FONT,
					fontWeight: 600,
					fontSize: 44,
					letterSpacing: '0.01em',
					color: C.paper,
					opacity: mark,
					transform: `translateY(${(1 - mark) * -16}px)`,
				}}
			>
				{p.brandName}
				<span style={{color: C.orange}}>.</span>
			</div>

			<Words
				text={p.ctaHeadline}
				start={8}
				stagger={3}
				accent={p.ctaAccent}
				style={{...headline, fontSize: 100, marginTop: 70, textAlign: 'center', maxWidth: 1500}}
			/>

			<FadeUp delay={24} style={{...subline, fontSize: 34, marginTop: 36, maxWidth: 1100, textAlign: 'center'}}>
				{p.ctaSub}
			</FadeUp>

			<div
				style={{
					position: 'relative',
					marginTop: 56,
					height: 104,
					padding: '0 56px',
					borderRadius: 52,
					background: C.orange,
					boxShadow: '0 18px 44px rgba(226,70,47,0.35)',
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					fontFamily: FONT,
					fontWeight: 700,
					fontSize: 38,
					color: C.paper,
					overflow: 'hidden',
					opacity: btn,
					transform: `scale(${(0.9 + 0.1 * btn) * breathe})`,
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 0,
						bottom: 0,
						width: 140,
						left: sheen,
						background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
						transform: 'skewX(-20deg)',
					}}
				/>
				<span style={{position: 'relative'}}>{p.ctaButton}</span>
				<svg width={32} height={32} viewBox="0 0 24 24" style={{position: 'relative'}} fill="none" stroke={C.paper} strokeWidth={2.6} strokeLinecap="round">
					<line x1="4" y1="12" x2="19" y2="12" />
					<polyline points="13,6 19,12 13,18" />
				</svg>
			</div>

			<FadeUp delay={44} style={{marginTop: 34, fontFamily: FONT, fontSize: 30, fontWeight: 600, letterSpacing: '0.04em', color: C.muted}}>
				{p.url}
			</FadeUp>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Finale: phone -> estimate request -> local map -> end card          */
/* ------------------------------------------------------------------ */

const FinaleScene: React.FC<{p: SeoAnimationProps}> = ({p}) => {
	const frame = useCurrentFrame();

	// 1. Push into the phone's map until it fills the frame.
	const push = interpolate(frame, [FIN.pushStart, FIN.pushEnd], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const pushScale = Math.pow(PUSH_SCALE, push);
	// Map centre inside the phone stage, in screen pixels, once the phone is upright.
	const MAP_X = 1060 + 150 + 14 + 20 + PHONE_MAP_W / 2;
	const MAP_Y = 70 + 80 + 14 + 146 + PHONE_MAP_H / 2;
	const captionOut = interpolate(frame, [FIN.pushStart - 6, FIN.pushStart + 6], [1, 0], clamp);

	// 2. Pull back over the neighbourhood, then keep drifting gently.
	const pull = interpolate(frame, [FIN.pushEnd, FIN.pullEnd], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const mapZoom = MAP_ZOOM * Math.pow(0.15, pull) * (1 - 0.0004 * Math.max(0, frame - FIN.pullEnd));
	const mapUi = interpolate(frame, [FIN.pushEnd, FIN.pushEnd + 20], [UI_BOOST, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const mapOut = interpolate(frame, [FIN.endCard - 10, FIN.endCard + 6], [1, 0], clamp);
	const scrim = interpolate(frame, [FIN.mapCopy - 10, FIN.mapCopy + 10], [0, 1], clamp);
	// Starts centred (so the hand-off from the phone is exact), then moves the pin clear of the headline.
	const pinShift = 230 * pull;
	const mapCam: Pt = [-pinShift / mapZoom, 0];

	return (
		<AbsoluteFill>
			{frame >= FIN.pushEnd && mapOut > 0 ? (
				<AbsoluteFill style={{opacity: mapOut}}>
					<LocalMap width={WIDTH} height={HEIGHT} zoom={mapZoom} time={frame} uiScale={mapUi} cam={mapCam} business={p.businessName} />
					<AbsoluteFill
						style={{
							opacity: scrim,
							background:
								'linear-gradient(90deg, rgba(14,21,48,0.94) 0%, rgba(14,21,48,0.8) 34%, rgba(14,21,48,0) 62%)',
						}}
					/>
					<Sequence from={FIN.mapCopy} layout="none">
						<div style={{position: 'absolute', left: 140, top: 380, width: 900}}>
							<Words text={p.mapHeadline} start={0} stagger={3} style={{...headline, fontSize: 84}} />
							<FadeUp delay={22} style={{...subline, marginTop: 36}}>
								{p.mapSub}
							</FadeUp>
						</div>
					</Sequence>
					<Sequence from={FIN.inquiries} layout="none">
						<InquiryCards />
					</Sequence>
				</AbsoluteFill>
			) : null}

			{frame < FIN.pushEnd ? (
				<AbsoluteFill>
					<div style={{position: 'absolute', left: 140, top: 360, width: 820, opacity: captionOut}}>
						<Words text={p.phoneHeadline} start={8} stagger={4} accent={p.phoneAccent} style={headline} />
					</div>
					<AbsoluteFill
						style={{
							transformOrigin: `${MAP_X}px ${MAP_Y}px`,
							transform: `translate(${(WIDTH / 2 - MAP_X) * push}px, ${(HEIGHT / 2 - MAP_Y) * push}px) scale(${pushScale})`,
						}}
					>
						<PhoneInHand query={p.phoneQuery} business={p.businessName} push={push} mapTime={frame} />
					</AbsoluteFill>
				</AbsoluteFill>
			) : null}

			<Sequence from={FIN.endCard} layout="none">
				<AbsoluteFill style={{opacity: interpolate(frame, [FIN.endCard - 4, FIN.endCard + 10], [0, 1], clamp)}}>
					<EndCard p={p} />
				</AbsoluteFill>
			</Sequence>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Main composition: the explainer                                     */
/* ------------------------------------------------------------------ */

export const SeoAnimation: React.FC<SeoAnimationProps> = (props) => {
	const p = {...defaultSeoProps, ...props};
	return (
		<AbsoluteFill style={{background: C.navy, fontFamily: FONT}}>
			<Backdrop />

			<Sequence from={SCENES.opening.from} durationInFrames={SCENES.opening.duration} name="1 Opportunity">
				<SceneFade duration={SCENES.opening.duration}>
					<OpeningScene hook={p.hook} accent={p.hookAccent} sub={p.hookSub} queries={p.openingQueries} />
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.search.from} durationInFrames={SCENES.search.duration} name="2 Found in search">
				<SceneFade duration={SCENES.search.duration}>
					<SearchScene
						headlineText={p.search}
						accent={p.searchAccent}
						sub={p.searchSub}
						query={p.searchQuery}
						business={p.businessName}
						domain={p.businessDomain}
					/>
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.ai.from} durationInFrames={SCENES.ai.duration} name="3 Search, Maps and AI">
				<SceneFade duration={SCENES.ai.duration}>
					<AiScene headlineText={p.aiHeadline} accent={p.aiAccent} prompt={p.aiPrompt} business={p.businessName} domain={p.businessDomain} />
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.finale.from} durationInFrames={SCENES.finale.duration} name="4-5 Inquiry, map, end card">
				<SceneFade duration={SCENES.finale.duration}>
					<FinaleScene p={p} />
				</SceneFade>
			</Sequence>

			<Grain />
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Background cut: 12-second seamless loop, no copy, for behind HTML   */
/* ------------------------------------------------------------------ */

export const SeoBackgroundLoop: React.FC = () => {
	const frame = useCurrentFrame();
	const t = (frame / BG_LOOP_FRAMES) * Math.PI * 2;
	// Camera circles slowly around the pin and returns to its start on the last frame.
	// The pin stays in the right third, clear of a left-aligned HTML headline.
	const cam: Pt = [150 * Math.sin(t) - 620, 160 * Math.cos(t) - 120];
	const zoom = 0.95 + 0.06 * Math.sin(t);

	return (
		<AbsoluteFill style={{background: C.navy}}>
			<LocalMap width={WIDTH} height={HEIGHT} zoom={zoom} time={frame} uiScale={1} cam={cam} loop={BG_LOOP_FRAMES} labels={0} business="" />
			{/* left side stays calm so the page's HTML headline and button read over it */}
			<AbsoluteFill
				style={{
					background: 'linear-gradient(90deg, rgba(14,21,48,0.9) 0%, rgba(14,21,48,0.6) 38%, rgba(14,21,48,0.1) 70%)',
				}}
			/>
			<Grain />
		</AbsoluteFill>
	);
};
