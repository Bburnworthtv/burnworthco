import React from 'react';
import {Composition} from 'remotion';
import {
	DURATION_IN_FRAMES,
	FPS,
	HEIGHT,
	SeoAnimation,
	WIDTH,
	defaultSeoProps,
} from './SeoAnimation';

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="SeoHero"
			component={SeoAnimation}
			durationInFrames={DURATION_IN_FRAMES}
			fps={FPS}
			width={WIDTH}
			height={HEIGHT}
			defaultProps={defaultSeoProps}
		/>
	);
};
