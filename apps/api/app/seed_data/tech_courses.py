"""Course content for the Frontend, Backend, Full Stack and Data Analyst courses.

Each course has 4 topics x 5 questions = 20 multiple-choice questions. A question is
(difficulty 1-3, body, [option A, B, C, D], index of the correct option, index of the option carrying the
topic's misconception tag or None). Notes are (title, link or text, level) and are seeded as approved.
"""

COURSES = [
    {
        "code": "FE-101",
        "name": "Frontend Development",
        "mentor": "mentor1@example.com",
        "candidates": range(1, 16),
        "topics": [
            {
                "name": "HTML & Accessibility",
                "misconception": "Treats visual styling as a substitute for semantic HTML",
                "notes": [
                    (
                        "MDN: HTML reference and guides",
                        "https://developer.mozilla.org/en-US/docs/Web/HTML",
                        "intro",
                    ),
                    (
                        "MDN: Accessibility",
                        "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which element should wrap the main navigation links of a page?",
                        ["<nav>", '<div class="nav">', "<menu>", "<section>"],
                        0,
                        1,
                    ),
                    (
                        1,
                        "What is the main purpose of the alt attribute on an <img>?",
                        [
                            "To give a text alternative for people who cannot see the image",
                            "To show a tooltip on hover",
                            "To improve image compression",
                            "To place a caption under the image",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        'How do you correctly connect a visible label to an input with id="email"?',
                        [
                            '<label for="email">Email</label>',
                            '<label name="email">Email</label>',
                            '<span aria="email">Email</span>',
                            '<label id="email">Email</label>',
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "A clickable <div> with an onclick handler is an accessibility problem mainly because…",
                        [
                            "It is not focusable or operable with the keyboard by default",
                            "It cannot be styled",
                            "It slows down page rendering",
                            "Nothing is wrong as long as it is styled to look like a button",
                        ],
                        0,
                        3,
                    ),
                    (
                        3,
                        "Which heading structure is best for a page with one title and two sections?",
                        [
                            "One h1 for the title, then an h2 for each section",
                            "An h1 for every section title",
                            "An h3 for the title so it looks smaller",
                            "Any heading levels; only the font size matters",
                        ],
                        0,
                        3,
                    ),
                ],
            },
            {
                "name": "CSS & Layout",
                "misconception": "Confuses the flex main axis with the cross axis",
                "notes": [
                    (
                        "MDN: Flexible box layout",
                        "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout",
                        "core",
                    ),
                    (
                        "MDN: CSS grid layout",
                        "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "In a flex container with flex-direction: row, which property spaces items along the horizontal axis?",
                        ["justify-content", "align-items", "align-content", "text-align"],
                        0,
                        1,
                    ),
                    (
                        2,
                        "With flex-direction: column, which property centres the items horizontally?",
                        [
                            "align-items: center",
                            "justify-content: center",
                            "text-align: center",
                            "vertical-align: middle",
                        ],
                        0,
                        1,
                    ),
                    (
                        1,
                        "Which selector has the highest specificity?",
                        ["#header .title", ".header .title", "header h1", "*"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What does box-sizing: border-box change?",
                        [
                            "Width and height include padding and border",
                            "Width no longer includes the content",
                            "Margins start to collapse",
                            "The element becomes a flex container",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Which CSS feature is designed for two-dimensional layouts of rows and columns?",
                        ["CSS Grid", "Flexbox", "float", "position: absolute"],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "JavaScript",
                "misconception": "Assumes asynchronous code runs in the order it is written",
                "notes": [
                    (
                        "MDN: JavaScript Guide",
                        "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
                        "intro",
                    ),
                    (
                        "MDN: Using promises",
                        "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "What does typeof null return?",
                        ['"object"', '"null"', '"undefined"', '"number"'],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What is logged? console.log(1); setTimeout(() => console.log(2), 0); console.log(3);",
                        ["1, 3, 2", "1, 2, 3", "2, 1, 3", "3, 2, 1"],
                        0,
                        1,
                    ),
                    (
                        1,
                        "Which keyword declares a block-scoped variable that cannot be reassigned?",
                        ["const", "let", "var", "static"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What is the result of [1, 2, 3].map(x => x * 2)?",
                        ["[2, 4, 6]", "[1, 2, 3, 2]", "12", "undefined"],
                        0,
                        None,
                    ),
                    (
                        3,
                        "An async function returns 42. What does calling it give you?",
                        [
                            "A Promise that resolves to 42",
                            "The number 42 immediately",
                            "undefined until it finishes",
                            "A callback function",
                        ],
                        0,
                        1,
                    ),
                ],
            },
            {
                "name": "React",
                "misconception": "Expects state updates to be visible immediately after calling the setter",
                "notes": [
                    ("React: Learn React", "https://react.dev/learn", "intro"),
                    ("React: State as a snapshot", "https://react.dev/learn/state-as-a-snapshot", "core"),
                ],
                "questions": [
                    (
                        1,
                        "What does useState return?",
                        [
                            "An array with the current value and a setter function",
                            "Only the current value",
                            "An object with get and set methods",
                            "A Promise",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "After setCount(count + 1) in a click handler, what does count hold on the next line of that handler?",
                        [
                            "The old value, until the next render",
                            "The new value immediately",
                            "undefined",
                            "A Promise of the new value",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "Why should items rendered with map have a stable key prop?",
                        [
                            "So React can match items between renders",
                            "To style each item",
                            "To make items focusable",
                            "Keys are only used for performance logging",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "When does useEffect(fn, []) run its effect?",
                        [
                            "After the first render (and again if the component remounts)",
                            "On every render",
                            "Before the first render",
                            "Only when the component unmounts",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "What is the recommended way to update state based on its previous value?",
                        [
                            "setCount(c => c + 1)",
                            "setCount(count++)",
                            "count = count + 1",
                            "this.state.count++",
                        ],
                        0,
                        None,
                    ),
                ],
            },
        ],
    },
    {
        "code": "BE-101",
        "name": "Backend Development",
        "mentor": "mentor2@example.com",
        "candidates": range(16, 31),
        "topics": [
            {
                "name": "HTTP & REST APIs",
                "misconception": "Uses HTTP methods interchangeably regardless of safety and idempotency",
                "notes": [
                    (
                        "MDN: HTTP request methods",
                        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods",
                        "core",
                    ),
                    (
                        "MDN: HTTP response status codes",
                        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
                        "intro",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which status code means a resource was created successfully?",
                        ["201", "200", "204", "302"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Which HTTP method is idempotent and typically replaces a resource?",
                        ["PUT", "POST", "PATCH", "CONNECT"],
                        0,
                        1,
                    ),
                    (
                        1,
                        "The user is signed in but lacks permission for a resource. Which status code fits?",
                        ["403 Forbidden", "401 Unauthorized", "404 Not Found", "500 Internal Server Error"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Why should a GET request not change data on the server?",
                        [
                            "GET is defined as safe, so caches, crawlers and prefetching may repeat it",
                            "GET requests cannot carry parameters",
                            "GET is slower than POST",
                            "It does not matter; any method may change data if the handler allows it",
                        ],
                        0,
                        3,
                    ),
                    (
                        3,
                        "A client retries a payment request after a timeout. What prevents a double charge?",
                        [
                            "An idempotency key that the server stores and checks",
                            "Switching the request from POST to GET",
                            "Returning 200 instead of 201",
                            "Adding a Content-Type header",
                        ],
                        0,
                        1,
                    ),
                ],
            },
            {
                "name": "Databases & SQL",
                "misconception": "Believes an index makes every query faster",
                "notes": [
                    ("PostgreSQL tutorial", "https://www.postgresql.org/docs/current/tutorial.html", "intro"),
                    (
                        "PostgreSQL: Indexes",
                        "https://www.postgresql.org/docs/current/indexes.html",
                        "advanced",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which SQL clause filters rows after grouping?",
                        ["HAVING", "WHERE", "ORDER BY", "LIMIT"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What does a foreign key constraint guarantee?",
                        [
                            "The value exists in the referenced table's key",
                            "The column is unique",
                            "The column cannot be NULL",
                            "The column is indexed automatically in every database",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "An index on a column usually…",
                        [
                            "Speeds up lookups on that column but adds a small cost to writes",
                            "Speeds up every query on the table",
                            "Slows down reads",
                            "Has no storage cost",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "Two transfers update the same balance at the same time. What problem does a transaction prevent?",
                        ["A lost update", "A syntax error", "A missing index", "Network latency"],
                        0,
                        None,
                    ),
                    (
                        3,
                        "The N+1 query problem is best fixed by…",
                        [
                            "Loading the related rows in one joined or batched query",
                            "Adding an index to every column",
                            "Increasing the connection pool size",
                            "Caching only the first query",
                        ],
                        0,
                        1,
                    ),
                ],
            },
            {
                "name": "Authentication & Security",
                "misconception": "Confuses encoding or hashing with encryption",
                "notes": [
                    ("OWASP Top 10", "https://owasp.org/www-project-top-ten/", "core"),
                    (
                        "OWASP Password Storage Cheat Sheet",
                        "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "How should passwords be stored?",
                        [
                            "Hashed with a slow, salted algorithm such as bcrypt, scrypt or Argon2",
                            "Encrypted with AES so they can be recovered",
                            "Base64-encoded",
                            "In plain text in a protected table",
                        ],
                        0,
                        2,
                    ),
                    (
                        2,
                        "The payload of a standard signed JWT is…",
                        [
                            "Base64url-encoded and readable by anyone who has the token",
                            "Encrypted so only the server can read it",
                            "Hashed so nobody can read it",
                            "Compressed binary data",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "Which practice prevents SQL injection?",
                        [
                            "Parameterised queries",
                            "Escaping quotes by hand",
                            "Hiding error messages",
                            "Using POST instead of GET",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Why set the HttpOnly flag on a session cookie?",
                        [
                            "JavaScript on the page cannot read it, which limits token theft through XSS",
                            "It encrypts the cookie",
                            "It makes the cookie expire when the tab closes",
                            "It allows cross-site requests",
                        ],
                        0,
                        1,
                    ),
                    (
                        3,
                        "What does CORS control?",
                        [
                            "Whether scripts from other origins may read your API's responses in a browser",
                            "All requests coming from other servers",
                            "SQL injection attempts",
                            "Brute-force login attempts",
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "Node.js & Express",
                "misconception": "Thinks Node.js runs each request on its own thread",
                "notes": [
                    (
                        "Node.js: Introduction to Node.js",
                        "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs",
                        "intro",
                    ),
                    ("Express: Routing guide", "https://expressjs.com/en/guide/routing.html", "core"),
                ],
                "questions": [
                    (
                        1,
                        "Node.js executes your JavaScript…",
                        [
                            "On a single main thread with an event loop",
                            "On a new thread for each request",
                            "Only inside the browser",
                            "In one process per CPU core automatically",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "What happens if a request handler runs a long CPU-bound loop?",
                        [
                            "Other requests wait until it finishes",
                            "Only that one request slows down",
                            "Node moves it to another thread automatically",
                            "The loop is skipped",
                        ],
                        0,
                        1,
                    ),
                    (
                        1,
                        "In Express middleware, what does calling next() do?",
                        [
                            "Passes control to the next matching middleware or route",
                            "Ends the response",
                            "Restarts the server",
                            "Skips all remaining routes",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Which code reads the id from the route /users/:id?",
                        ["req.params.id", "req.query.id", "req.body.id", "res.locals.id"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Where should secrets such as database passwords be kept?",
                        [
                            "In environment variables or a secrets manager",
                            "Hard-coded in the source",
                            "In package.json",
                            "In client-side JavaScript",
                        ],
                        0,
                        None,
                    ),
                ],
            },
        ],
    },
    {
        "code": "FS-101",
        "name": "Full Stack Development",
        "mentor": "mentor1@example.com",
        "candidates": range(1, 31),
        "topics": [
            {
                "name": "Web Architecture",
                "misconception": "Assumes server-side and client-side rendering behave the same on first load",
                "notes": [
                    (
                        "Rendering on the web (web.dev)",
                        "https://web.dev/articles/rendering-on-the-web",
                        "core",
                    ),
                    (
                        "Summary: how a web request flows",
                        "Browser -> DNS -> CDN for static files -> API server for data -> database. Server rendering sends "
                        "ready HTML in the first response; client rendering sends a shell and builds the page with JavaScript.",
                        "intro",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "In a typical web application, what is the role of the API server?",
                        [
                            "Expose data and business logic to clients over HTTP",
                            "Render CSS for the browser",
                            "Store the browser cache",
                            "Compile TypeScript inside the browser",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What is a key benefit of server-side rendering (SSR)?",
                        [
                            "The content is in the first HTML response, which helps first paint and SEO",
                            "No JavaScript is ever needed",
                            "It removes the need for an API",
                            "First load behaves exactly like client-side rendering",
                        ],
                        0,
                        3,
                    ),
                    (
                        2,
                        "Why do applications put static files on a CDN?",
                        [
                            "To serve them from locations close to users",
                            "To run database queries",
                            "To encrypt passwords",
                            "To replace the backend",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        'What does "stateless" mean for a REST API server?',
                        [
                            "Each request carries what it needs; the server keeps no client session in memory",
                            "The server has no database",
                            "Responses are never cached",
                            "The API has no versioning",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "A single-page app shows a blank screen until a large JavaScript bundle loads. What helps most?",
                        [
                            "Code-splitting plus server rendering of the first view",
                            "A faster server CPU",
                            "Adding more API endpoints",
                            "Turning off HTTPS",
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "APIs & Integration",
                "misconception": "Trusts data from the client without validating it on the server",
                "notes": [
                    (
                        "MDN: Cross-Origin Resource Sharing (CORS)",
                        "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
                        "core",
                    ),
                    (
                        "OWASP Input Validation Cheat Sheet",
                        "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Where must input validation always happen?",
                        [
                            "On the server, even if the client validates too",
                            "Only in the browser form",
                            "Only in the database",
                            "Nowhere; validation is optional for JSON APIs",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "What does a 409 Conflict response usually signal?",
                        [
                            "The request conflicts with the current state, such as a duplicate or version clash",
                            "The server crashed",
                            "The user is not signed in",
                            "The URL does not exist",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Why do list endpoints use pagination?",
                        [
                            "To keep responses small and fast as data grows",
                            "To hide data from admins",
                            "Because JSON cannot hold long arrays",
                            "To avoid authentication",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "The frontend and API run on different origins. What must the API configure so the browser allows the calls?",
                        [
                            "CORS headers that allow that origin",
                            "A larger request body limit",
                            "HTTP/2",
                            "A CDN",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "What should a webhook receiver do first?",
                        [
                            "Verify the request signature before trusting the payload",
                            "Process the payload immediately",
                            "Return 500 so the sender retries",
                            "Store the raw payload in the frontend",
                        ],
                        0,
                        1,
                    ),
                ],
            },
            {
                "name": "Deployment & DevOps",
                "misconception": "Treats a container as a full virtual machine",
                "notes": [
                    ("Docker: Get started", "https://docs.docker.com/get-started/", "intro"),
                    ("Pro Git (free book)", "https://git-scm.com/book/en/v2", "core"),
                ],
                "questions": [
                    (
                        1,
                        "What does git commit do?",
                        [
                            "Records the staged changes in the local repository history",
                            "Uploads changes to the remote",
                            "Merges two branches",
                            "Deletes untracked files",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Compared with a virtual machine, a container…",
                        [
                            "Shares the host kernel and packages the app with its dependencies",
                            "Includes its own full operating system kernel",
                            "Cannot run on Linux",
                            "Is always slower to start",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "What is the main purpose of continuous integration (CI)?",
                        [
                            "Automatically build and test every change",
                            "Deploy straight to production without tests",
                            "Back up the database",
                            "Monitor CPU usage",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Where should a production deployment read its database URL from?",
                        [
                            "An environment variable or secret store",
                            "A value committed to the repository",
                            "The browser's localStorage",
                            "A comment in the Dockerfile",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "Why copy dependency files and install them before copying the source code in a Dockerfile?",
                        [
                            "The dependency layer is cached and reused when only the source changes",
                            "It encrypts the image",
                            "Docker syntax requires it",
                            "It removes the need for a .dockerignore file",
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "Performance & Caching",
                "misconception": "Expects a cache never to return stale data",
                "notes": [
                    (
                        "MDN: HTTP caching",
                        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching",
                        "core",
                    ),
                    (
                        "web.dev: Browser-level image lazy loading",
                        "https://web.dev/articles/browser-level-image-lazy-loading",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "What does the header Cache-Control: no-store mean?",
                        [
                            "The response must not be stored by any cache",
                            "Cache it for one hour",
                            "Store it only in the browser",
                            "Compress the response",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "A cache with a 5-minute expiry (TTL) can…",
                        [
                            "Serve data up to 5 minutes old after the source changes",
                            "Never return outdated data",
                            "Only cache images",
                            "Update itself the instant the database changes",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "What does lazy loading images do?",
                        [
                            "Defers loading off-screen images until they are needed",
                            "Lowers image quality",
                            "Loads all images before the page appears",
                            "Converts images to SVG",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Which change usually reduces the JavaScript a page downloads?",
                        [
                            "Code-splitting by route",
                            "Adding more polyfills",
                            "Inlining every library",
                            "Disabling compression",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "After a product price changes, users still see the old price. What is a sensible fix?",
                        [
                            "Invalidate or update the cached entry when the price changes",
                            "Restart every server",
                            "Lower the CPU limit",
                            "Remove the database index",
                        ],
                        0,
                        1,
                    ),
                ],
            },
        ],
    },
    {
        "code": "DA-101",
        "name": "Data Analyst",
        "mentor": "mentor2@example.com",
        "candidates": range(8, 23),
        "topics": [
            {
                "name": "SQL for Analysis",
                "misconception": "Uses WHERE to filter aggregated values instead of HAVING",
                "notes": [
                    (
                        "PostgreSQL: Aggregate functions",
                        "https://www.postgresql.org/docs/current/tutorial-agg.html",
                        "intro",
                    ),
                    (
                        "PostgreSQL: Window functions",
                        "https://www.postgresql.org/docs/current/tutorial-window.html",
                        "advanced",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which query counts orders per customer?",
                        [
                            "SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id",
                            "SELECT customer_id, COUNT(*) FROM orders",
                            "SELECT COUNT(customer_id) FROM orders ORDER BY customer_id",
                            "SELECT DISTINCT COUNT(*) FROM orders",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "After grouping, which clause keeps only customers with more than 5 orders?",
                        ["HAVING COUNT(*) > 5", "WHERE COUNT(*) > 5", "LIMIT 5", "ORDER BY COUNT(*) > 5"],
                        0,
                        1,
                    ),
                    (
                        2,
                        "A LEFT JOIN from customers to orders returns…",
                        [
                            "All customers, with NULL order columns where there is no match",
                            "Only customers who have orders",
                            "Only orders without customers",
                            "Every combination of customers and orders",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "Which expression ranks rows within each region by sales without collapsing the rows?",
                        [
                            "RANK() OVER (PARTITION BY region ORDER BY sales DESC)",
                            "GROUP BY region",
                            "ORDER BY sales",
                            "MAX(sales)",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "How does COUNT(column) differ from COUNT(*)?",
                        [
                            "It ignores NULLs in that column",
                            "It counts distinct values only",
                            "It is always faster",
                            "It counts columns instead of rows",
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "Statistics",
                "misconception": "Treats correlation as evidence of causation",
                "notes": [
                    (
                        "Khan Academy: Statistics and probability",
                        "https://www.khanacademy.org/math/statistics-probability",
                        "intro",
                    ),
                    (
                        "Correlation is not causation",
                        "Two variables can move together because of a third factor, chance or reverse causation. "
                        "Randomised experiments (such as A/B tests) are the usual way to test cause and effect.",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which measure of the centre is least affected by extreme outliers?",
                        ["Median", "Mean", "Range", "Standard deviation"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Ice-cream sales and drowning incidents rise together. What is the best conclusion?",
                        [
                            "A third factor, such as hot weather, may drive both",
                            "Ice cream causes drowning",
                            "Drowning causes ice-cream sales",
                            "The data must be wrong",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "What does a p-value of 0.03 mean?",
                        [
                            "If the null hypothesis were true, results this extreme would occur about 3% of the time",
                            "There is a 3% chance the null hypothesis is true",
                            "The effect size is 3%",
                            "The result is 97% certain to be important",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "What does the standard deviation describe?",
                        [
                            "How spread out the values are around the mean",
                            "The middle value",
                            "The most frequent value",
                            "The sample size",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "An A/B test shows that variant B converted better. What makes this conclusion stronger?",
                        [
                            "Random assignment and a large enough sample",
                            "Choosing users who already liked B",
                            "Stopping the test as soon as B looks ahead",
                            "Running B only at weekends",
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "Python & pandas",
                "misconception": "Expects pandas operations to change the DataFrame in place",
                "notes": [
                    (
                        "pandas: 10 minutes to pandas",
                        "https://pandas.pydata.org/docs/user_guide/10min.html",
                        "intro",
                    ),
                    (
                        "pandas: Merge, join and concatenate",
                        "https://pandas.pydata.org/docs/user_guide/merging.html",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which call shows the first five rows of a DataFrame df?",
                        ["df.head()", "df.first()", "df.top(5)", "df.show(5)"],
                        0,
                        None,
                    ),
                    (
                        2,
                        "You run df.dropna() on its own line. Afterwards df…",
                        [
                            "Is unchanged, because dropna returns a new DataFrame",
                            "Has its rows with missing values removed",
                            "Is deleted",
                            "Has missing values filled with 0",
                        ],
                        0,
                        1,
                    ),
                    (
                        2,
                        "Which expression selects the rows where sales is greater than 100?",
                        [
                            'df[df["sales"] > 100]',
                            'df["sales" > 100]',
                            "df.select(sales > 100)",
                            'df.where("sales > 100")',
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        'What does df.groupby("region")["sales"].sum() return?',
                        [
                            "Total sales for each region",
                            "The overall sum of sales",
                            "The number of regions",
                            "All rows sorted by region",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "Two DataFrames share a customer_id column. Which call combines them like a SQL join?",
                        [
                            'pd.merge(a, b, on="customer_id")',
                            "pd.concat([a, b])",
                            "a + b",
                            'a.join("customer_id")',
                        ],
                        0,
                        None,
                    ),
                ],
            },
            {
                "name": "Data Visualization",
                "misconception": "Chooses chart types for appearance rather than for the comparison being made",
                "notes": [
                    ("Matplotlib tutorials", "https://matplotlib.org/stable/tutorials/index.html", "intro"),
                    (
                        "Choosing a chart",
                        "Trend over time: line chart. Compare categories: sorted bar chart. Relationship between two numbers: "
                        "scatter plot. Part of a whole with 2-3 parts: pie or stacked bar. Start bar axes at zero.",
                        "core",
                    ),
                ],
                "questions": [
                    (
                        1,
                        "Which chart best shows a trend in monthly revenue over two years?",
                        ["Line chart", "Pie chart", "Word cloud", "Donut chart"],
                        0,
                        1,
                    ),
                    (
                        2,
                        "Why should the value axis of a bar chart usually start at zero?",
                        [
                            "Bar length encodes the value, so a cut axis exaggerates differences",
                            "Every charting tool requires it",
                            "It makes the chart load faster",
                            "Zero makes the colours brighter",
                        ],
                        0,
                        None,
                    ),
                    (
                        2,
                        "Which chart best shows the relationship between two numeric variables?",
                        ["Scatter plot", "Pie chart", "Stacked area chart", "Donut chart"],
                        0,
                        1,
                    ),
                    (
                        2,
                        "A dashboard uses only red and green to show good and bad. What is the risk?",
                        [
                            "Colour-blind readers may not be able to tell them apart",
                            "The file becomes too large",
                            "Red and green cannot be printed",
                            "Charts must always be blue",
                        ],
                        0,
                        None,
                    ),
                    (
                        3,
                        "You need to compare the market share of 12 products. What is the clearest option?",
                        [
                            "A sorted horizontal bar chart",
                            "A pie chart with 12 slices",
                            "A 3D pie chart",
                            "A radar chart",
                        ],
                        0,
                        1,
                    ),
                ],
            },
        ],
    },
]
