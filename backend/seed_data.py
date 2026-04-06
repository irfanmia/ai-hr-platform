"""
Seed script — run from backend/ directory with venv activated.
Updates existing jobs with elaborated descriptions.
"""
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from jobs.models import Job

JOB_SEEDS = [
    {
        "title": "Software Engineer",
        "department": "Engineering",
        "location_type": "hybrid",
        "experience_years_min": 3,
        "experience_years_max": 5,
        "skills": ["Python", "Django", "React", "PostgreSQL", "REST APIs", "Git"],
        "salary_min": 90000,
        "salary_max": 130000,
        "description": (
            "We're building an AI-first HR platform that transforms how companies hire talent. "
            "As a Software Engineer, you'll work across our full stack — designing RESTful APIs in Django, "
            "building interactive React interfaces, and optimising PostgreSQL queries that power candidate "
            "evaluations for thousands of companies.\n\n"
            "You'll collaborate directly with product managers and designers in a fast-paced, two-week sprint cycle. "
            "Code quality matters here — we run thorough code reviews, maintain high test coverage, and follow "
            "clean architecture principles. You'll have real ownership over features from design through deployment, "
            "and your work will directly affect the experience of both HR teams and job candidates."
        ),
        "requirements": (
            "3–5 years of professional software engineering experience in a product company.\n"
            "Strong proficiency in Python and the Django ecosystem (DRF, ORM, Celery).\n"
            "Solid experience building React applications with TypeScript.\n"
            "Comfortable designing and optimising PostgreSQL schemas and queries.\n"
            "Proven ability to build and consume RESTful APIs.\n"
            "Familiarity with Git-based workflows, pull requests, and code reviews.\n"
            "Understanding of software testing principles (unit, integration, e2e).\n"
            "Experience with Docker and basic CI/CD pipelines is a plus.\n"
            "Strong written and verbal communication — you can explain technical decisions clearly.\n"
            "Bachelor's degree in Computer Science or equivalent practical experience."
        ),
        "responsibilities": (
            "Design, build, and maintain backend APIs using Django REST Framework.\n"
            "Build and improve React-based frontend components and pages with TypeScript.\n"
            "Write clear, well-tested, and maintainable code with appropriate test coverage.\n"
            "Participate actively in sprint planning, daily standups, and retrospectives.\n"
            "Conduct thorough code reviews and provide constructive feedback to peers.\n"
            "Debug and resolve production issues, including root cause analysis.\n"
            "Collaborate with designers to implement pixel-perfect, accessible UIs.\n"
            "Optimise database queries and API performance as the platform scales.\n"
            "Contribute to technical documentation, ADRs, and internal wikis.\n"
            "Mentor junior engineers and support their growth through pair programming and feedback."
        ),
        "custom_fields": {"employment_type": "Full-time", "interview_rounds": 4, "notice_period": "30 days"},
    },
    {
        "title": "Product Manager",
        "department": "Product",
        "location_type": "remote",
        "experience_years_min": 4,
        "experience_years_max": 7,
        "skills": ["Product Strategy", "Roadmapping", "Analytics", "Stakeholder Management", "User Research", "Agile"],
        "salary_min": 95000,
        "salary_max": 140000,
        "description": (
            "The Product Manager will own the strategy and execution of our core candidate-screening and "
            "recruiter-productivity products. You'll work at the intersection of user needs, business goals, "
            "and technical feasibility — defining what we build, why we build it, and how we measure success.\n\n"
            "In this role, you'll work closely with engineering, design, sales, and customer success to ensure "
            "every feature ships with clear goals and measurable outcomes. You'll conduct user research, "
            "analyse product analytics, and run discovery sessions with HR professionals across different industries. "
            "We're looking for someone who can think strategically, move quickly, and communicate with clarity."
        ),
        "requirements": (
            "4–7 years of product management experience, ideally in B2B SaaS.\n"
            "Proven track record of owning and shipping end-to-end product features.\n"
            "Strong analytical skills — comfortable with product analytics tools (Mixpanel, Amplitude, or similar).\n"
            "Experience writing clear, detailed Product Requirements Documents (PRDs) and user stories.\n"
            "Excellent stakeholder management skills — can align engineering, design, and business teams.\n"
            "Familiarity with agile methodologies (Scrum, Kanban) and sprint-based delivery.\n"
            "Experience conducting user interviews, usability tests, and customer discovery sessions.\n"
            "Ability to prioritise ruthlessly using frameworks like RICE, ICE, or MoSCoW.\n"
            "Strong commercial awareness — understands how product decisions affect revenue and retention.\n"
            "EdTech, HRTech, or AI product experience is a significant advantage."
        ),
        "responsibilities": (
            "Own the product roadmap for candidate screening and HR productivity features.\n"
            "Write comprehensive PRDs, user stories, and acceptance criteria for all features.\n"
            "Conduct user research, customer interviews, and usability studies to inform decisions.\n"
            "Define, track, and report on product KPIs and success metrics for each feature.\n"
            "Run sprint planning, backlog grooming, and feature prioritisation with engineering.\n"
            "Work with design to ensure a seamless, intuitive user experience across all surfaces.\n"
            "Collaborate with sales and customer success to gather market feedback and product gaps.\n"
            "Analyse usage data and A/B test results to make evidence-based product decisions.\n"
            "Present product updates and roadmap to leadership and key stakeholders.\n"
            "Stay ahead of market trends in AI, HR technology, and talent acquisition."
        ),
        "custom_fields": {"employment_type": "Full-time", "interview_rounds": 4, "notice_period": "30 days"},
    },
    {
        "title": "Data Analyst",
        "department": "Data",
        "location_type": "onsite",
        "experience_years_min": 2,
        "experience_years_max": 4,
        "skills": ["SQL", "Python", "Tableau", "Statistics", "Data Modelling", "Excel"],
        "salary_min": 70000,
        "salary_max": 100000,
        "description": (
            "As a Data Analyst, you'll transform raw hiring and candidate data into clear, actionable insights "
            "that help HR teams make smarter decisions. You'll build dashboards, define metrics, and run analyses "
            "that directly influence product direction, client reporting, and operational strategy.\n\n"
            "You'll work closely with the product, engineering, and customer success teams — translating business "
            "questions into analytical frameworks, building self-serve dashboards, and identifying trends in how "
            "candidates perform in AI-driven interviews. This is a high-impact role for someone who loves making "
            "data accessible and meaningful."
        ),
        "requirements": (
            "2–4 years of experience in a data analyst or business intelligence role.\n"
            "Strong SQL skills — comfortable writing complex queries, CTEs, window functions, and joins.\n"
            "Proficiency in Python for data manipulation (Pandas, NumPy) and basic statistical analysis.\n"
            "Experience building dashboards in Tableau, Power BI, Metabase, or similar tools.\n"
            "Solid understanding of statistics — distributions, correlation, significance testing.\n"
            "Ability to clean, validate, and model data from multiple sources.\n"
            "Strong communication skills — can translate complex findings into simple narratives for non-technical audiences.\n"
            "Experience with data warehousing concepts (star schema, fact/dimension tables) is a plus.\n"
            "Familiarity with A/B testing methodologies.\n"
            "Bachelor's degree in Statistics, Mathematics, Computer Science, or a related field."
        ),
        "responsibilities": (
            "Build and maintain dashboards and reports for HR clients, internal teams, and leadership.\n"
            "Write complex SQL queries to extract, transform, and analyse data from our data warehouse.\n"
            "Define and track key metrics across candidate performance, interview completion rates, and scoring.\n"
            "Partner with product and engineering to instrument new features for data capture.\n"
            "Conduct ad hoc analyses to answer business questions from stakeholders.\n"
            "Identify trends, anomalies, and patterns in candidate evaluation data.\n"
            "Present findings in weekly data reviews with clear visualisations and recommendations.\n"
            "Support A/B testing design and post-experiment analysis.\n"
            "Develop self-serve reporting tools so non-technical teams can access data independently.\n"
            "Ensure data quality and consistency across all reporting surfaces."
        ),
        "custom_fields": {"employment_type": "Full-time", "interview_rounds": 3, "notice_period": "30 days"},
    },
    {
        "title": "DevOps Engineer",
        "department": "Platform",
        "location_type": "hybrid",
        "experience_years_min": 4,
        "experience_years_max": 7,
        "skills": ["AWS", "Docker", "Kubernetes", "CI/CD", "Terraform", "Linux", "Nginx", "Monitoring"],
        "salary_min": 105000,
        "salary_max": 150000,
        "description": (
            "As a DevOps Engineer, you'll own the infrastructure, deployment pipelines, and platform reliability "
            "that power our AI-driven HR platform. You'll ensure our systems are highly available, scalable, and "
            "secure — supporting both our engineering team and the thousands of companies that rely on our platform "
            "daily for critical hiring decisions.\n\n"
            "You'll build and maintain our cloud infrastructure on AWS, manage containerised workloads with Docker "
            "and Kubernetes, and implement robust CI/CD pipelines that let our engineering team ship confidently. "
            "Observability, incident response, and infrastructure-as-code are core to this role."
        ),
        "requirements": (
            "4–7 years of DevOps, platform engineering, or SRE experience.\n"
            "Deep expertise in AWS (EC2, RDS, S3, ECS/EKS, IAM, VPC, CloudWatch).\n"
            "Strong experience with Docker and Kubernetes for container orchestration.\n"
            "Proficiency in Terraform or similar IaC tools for provisioning and managing infrastructure.\n"
            "Experience designing and maintaining CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins).\n"
            "Strong Linux system administration skills including networking, security hardening, and scripting.\n"
            "Experience with observability tools — Prometheus, Grafana, Datadog, or similar.\n"
            "Knowledge of web server configuration (Nginx, Apache) and SSL/TLS management.\n"
            "Familiarity with database management, backups, and PostgreSQL administration.\n"
            "Security mindset — experience with vulnerability scanning, secrets management, and compliance."
        ),
        "responsibilities": (
            "Design, provision, and maintain scalable AWS infrastructure using Terraform.\n"
            "Build and improve CI/CD pipelines for automated testing and zero-downtime deployments.\n"
            "Manage containerised workloads with Docker and Kubernetes (EKS or self-managed).\n"
            "Monitor system health, set up alerting, and respond to on-call incidents.\n"
            "Optimise platform performance, cost, and reliability across all environments.\n"
            "Implement and maintain security controls — IAM policies, network segmentation, secrets rotation.\n"
            "Manage database backups, replication, and disaster recovery procedures.\n"
            "Collaborate with engineers to improve developer experience — faster builds, simpler local setup.\n"
            "Conduct post-mortem analyses after incidents and drive root cause resolution.\n"
            "Document all infrastructure, runbooks, and operational procedures clearly."
        ),
        "custom_fields": {"employment_type": "Full-time", "interview_rounds": 4, "notice_period": "30 days", "on_call": "Yes"},
    },
    {
        "title": "UI/UX Designer",
        "department": "Design",
        "location_type": "remote",
        "experience_years_min": 3,
        "experience_years_max": 6,
        "skills": ["Figma", "UX Research", "Prototyping", "Design Systems", "Accessibility", "User Testing"],
        "salary_min": 80000,
        "salary_max": 115000,
        "description": (
            "We're looking for a UI/UX Designer who cares deeply about the human side of technology. "
            "You'll shape the experience of two very different users — HR professionals who need powerful, "
            "efficient tools, and job candidates who deserve a fair, stress-reducing application process.\n\n"
            "You'll own end-to-end design: from early discovery and research through wireframes, prototypes, "
            "and final high-fidelity designs. You'll work closely with product and engineering to ensure your "
            "designs are technically feasible and implemented with fidelity. A strong portfolio demonstrating "
            "both visual polish and user-centred thinking is essential."
        ),
        "requirements": (
            "3–6 years of UI/UX design experience in a product or agency environment.\n"
            "Expert-level Figma skills — components, auto-layout, variables, and prototyping.\n"
            "Experience conducting user research: interviews, usability tests, surveys, and synthesis.\n"
            "Proven ability to build and maintain comprehensive design systems.\n"
            "Strong visual design sense — typography, colour, spacing, and motion.\n"
            "Understanding of accessibility principles (WCAG 2.1 AA) and inclusive design.\n"
            "Experience working in agile product teams with engineers and PMs.\n"
            "Ability to handle multiple projects simultaneously and manage deadlines independently.\n"
            "Excellent written and verbal communication — can articulate design decisions clearly.\n"
            "Experience designing for SaaS, enterprise tools, or HR/recruiting platforms is a plus."
        ),
        "responsibilities": (
            "Lead end-to-end design for candidate-facing application flows and HR dashboard features.\n"
            "Conduct user research, usability testing, and synthesis to inform design decisions.\n"
            "Create wireframes, user flows, interactive prototypes, and final high-fidelity designs in Figma.\n"
            "Build and maintain a scalable design system used across all product surfaces.\n"
            "Collaborate with engineers to ensure accurate implementation of designs.\n"
            "Run design critiques and contribute to a culture of quality and feedback.\n"
            "Work with PM to validate designs against user needs and business goals.\n"
            "Ensure all designs meet accessibility standards and inclusive design principles.\n"
            "Iterate quickly based on user feedback, analytics, and A/B test results.\n"
            "Contribute to product strategy by bringing user insights and design thinking to planning."
        ),
        "custom_fields": {"employment_type": "Full-time", "portfolio_required": True, "interview_rounds": 3, "notice_period": "30 days"},
    },
    {
        "title": "Chief Executive Officer (CEO)",
        "department": "Executive Leadership",
        "location_type": "hybrid",
        "experience_years_min": 12,
        "experience_years_max": 20,
        "skills": ["Strategic Leadership", "EdTech", "P&L Management", "Product Vision", "Fundraising", "Team Building", "Go-to-Market", "Stakeholder Management"],
        "salary_min": 180000,
        "salary_max": 280000,
        "description": (
            "We are seeking a visionary and results-driven Chief Executive Officer to lead our EdTech company "
            "through its next phase of exponential growth. As CEO, you will define and execute our strategic vision, "
            "scale our AI-powered learning platform to millions of learners across emerging markets, and build a "
            "world-class organisation that delivers measurable educational and career outcomes.\n\n"
            "You will operate at the highest level — partnering with the Board of Directors, institutional investors, "
            "and strategic partners while simultaneously inspiring and leading a diverse global team. "
            "This is a rare opportunity for a proven executive to shape the future of education through technology "
            "and leave a lasting impact on how people access opportunity worldwide."
        ),
        "requirements": (
            "12–20 years of progressive leadership experience, with at least 5 years as a C-suite executive.\n"
            "Proven track record of scaling a SaaS, EdTech, or consumer technology company (10x growth preferred).\n"
            "Deep understanding of the global education market, learning science, and digital transformation.\n"
            "Demonstrated experience raising Series A/B/C funding — strong relationships with tier-1 VCs.\n"
            "Full P&L ownership experience with the ability to drive revenue growth and manage burn rate.\n"
            "Outstanding ability to recruit, inspire, and retain world-class talent across functions.\n"
            "Exceptional public presence — comfortable with media interviews, keynotes, and board presentations.\n"
            "Track record of building high-trust relationships with boards, investors, and government stakeholders.\n"
            "Experience scaling operations in South Asia, Middle East, or Africa is a strong advantage.\n"
            "MBA or advanced degree from a top institution preferred; proven results always take precedence."
        ),
        "responsibilities": (
            "Define and communicate a compelling company vision, mission, and 3–5 year strategic roadmap.\n"
            "Own overall business performance — revenue targets, user growth, retention, and profitability.\n"
            "Lead all fundraising rounds — manage investor relations, due diligence, and board reporting.\n"
            "Drive product strategy with CPO and CTO to ensure the platform leads the EdTech market.\n"
            "Build and scale a high-performance leadership team (C-suite and VPs) across all functions.\n"
            "Represent the company publicly — media, conferences, government partnerships, and strategic alliances.\n"
            "Establish a culture of learning, accountability, and innovation across the entire organisation.\n"
            "Oversee financial planning, budgeting, and disciplined capital allocation decisions.\n"
            "Identify and execute strategic M&A opportunities and market expansion into new geographies.\n"
            "Report to the Board of Directors with full transparency on performance, risks, and strategic bets."
        ),
        "custom_fields": {
            "employment_type": "Full-time",
            "equity": "0.5% - 2.0%",
            "notice_period": "3 months",
            "interview_rounds": 5,
            "reports_to": "Board of Directors"
        },
    },
]

updated = 0
created = 0
for payload in JOB_SEEDS:
    obj, was_created = Job.objects.update_or_create(
        title=payload["title"],
        defaults=payload,
    )
    if was_created:
        created += 1
    else:
        updated += 1

print(f"Done. Created: {created}, Updated: {updated}. Total: {len(JOB_SEEDS)} jobs.")
