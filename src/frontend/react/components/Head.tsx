type HeadProps = {
	title?: string;
	description?: string;
	icon?: string;
	font?: string;
	cssPath?: string;
};

const FOWT_SCRIPT = `(()=>{try{const s=localStorage.getItem('av-theme');const m=window.matchMedia('(prefers-color-scheme: light)').matches;const t=s||(m?'light':'dark');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}})();`;

export const Head = ({
	title = 'AbsoluteVitals',
	description = 'Core Web Vitals & uptime analytics',
	icon = '/assets/ico/favicon.ico',
	font = 'Inter',
	cssPath
}: HeadProps) => (
	<head>
		<meta charSet="utf-8" />
		<title>{title}</title>
		<meta content={description} name="description" />
		<meta content="width=device-width, initial-scale=1" name="viewport" />
		<link href={icon} rel="icon" />
		<link href="https://fonts.googleapis.com" rel="preconnect" />
		<link
			crossOrigin="anonymous"
			href="https://fonts.gstatic.com"
			rel="preconnect"
		/>
		<link
			href={`https://fonts.googleapis.com/css2?family=${font}:wght@100..900&display=swap`}
			rel="stylesheet"
		/>
		<link href="/styles/app.css" rel="stylesheet" type="text/css" />
		{cssPath && <link href={cssPath} rel="stylesheet" type="text/css" />}
		<script dangerouslySetInnerHTML={{ __html: FOWT_SCRIPT }} />
	</head>
);
