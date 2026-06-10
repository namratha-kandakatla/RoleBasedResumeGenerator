const form = document.querySelector("#resumeForm");
const projectsEl = document.querySelector("#projects");
const projectTemplate = document.querySelector("#projectTemplate");
const outputEl = document.querySelector("#resumeOutput");
const statusText = document.querySelector("#statusText");
const templateArea = form.elements.template;
const yearsInput = form.elements.years;
const templateListEl = document.querySelector("#templateList");
const templateUploadValidation = document.querySelector("#templateUploadValidation");
const copyBtn = document.querySelector("#copyBtn");
const downloadBtn = document.querySelector("#downloadBtn");
let uploadedDocxTemplate = null;
let latestResumeArtifacts = null;
let generatedParagraphId = 0x10000000;
let storedTemplates = [];
let activeTemplateId = null;
let resumeReady = false;
const DUPLICATE_BULLET_THRESHOLD = 0.3;
const DUPLICATE_REWRITE_PASSES = 4;
const FINAL_GENERATION_FAILURE_MESSAGE = "Resume generation needs more specific project details. Please add more client/domain/project information.";

const sampleTemplate = `Namratha K
[Insert Job Title Here]+1 (913)-253-6619 | namratha.k0322@gmail.com
______________________________________________________________________________________________

Summary:
[Insert Bullet points Here]

IT Skills:
[Insert Skill Matrix Here]

Work Experience:
Client: CVS Health, USA                             Dec 2025 - Present
Role:
Responsibilities:
[Insert Bullet points Here]

Client: World Kinect Corporation, USA                       Jan 2024 - Dec 2025
Role:
Responsibilities:
[Insert Bullet points Here]

Client: Infosys - CISCO, India            Dec 2021 - Dec 2022
Role:
Responsibilities:
[Insert Bullet points Here]

Client: TCS - Ericsson, India                  Jan 2018 - Dec 2021
Role:
Responsibilities:
[Insert Bullet points Here]`;

const skillBank = {
  "Programming Languages": ["C#", "Java", "JavaScript", "TypeScript", "Python", "SQL", "Bash", "PowerShell"],
  "Frameworks and CMS": ["Sitecore XP", "Sitecore XM", "Sitecore", "SXA", "Helix", ".NET", "ASP.NET MVC", "ASP.NET Core", "MVC", "Spring Boot", "Spring MVC", "React", "Angular", "Node.js", "Hibernate", "JPA"],
  "Cloud Platforms": ["AWS", "Azure", "GCP"],
  "Databases": ["PostgreSQL", "MySQL", "Oracle", "MongoDB", "DynamoDB", "SQL Server"],
  "CMS Authoring and Presentation": ["Content Editor", "Experience Editor", "Sitecore Workflows", "Templates", "Renderings", "Layouts", "Placeholder Settings", "Content Items", "Media Library"],
  "Search and Indexing": ["Solr", "Coveo", "Sitecore Search"],
  "Integration Technologies": ["REST APIs", "GraphQL", "SOAP", "JSON", "XML"],
  "Messaging Technologies": ["Kafka", "RabbitMQ", "SQS", "SNS", "ActiveMQ"],
  "DevOps Tools": ["Docker", "Kubernetes", "Terraform", "Maven", "Gradle", "PowerShell", "Ansible", "Helm"],
  "CI/CD Tools": ["Jenkins", "GitHub Actions", "GitLab CI", "Azure DevOps"],
  "Testing Tools": ["xUnit", "NUnit", "MSTest", "JUnit", "Mockito", "Jest", "Cypress", "Selenium"],
  "Monitoring Tools": ["Application Insights", "CloudWatch", "Splunk", "Grafana", "Prometheus", "ELK"],
  "Version Control": ["Git", "Bitbucket", "GitHub", "GitLab"],
  "Methodologies": ["Agile", "Scrum", "Kanban", "SDLC", "Waterfall", "SAFe"],
  "Architecture Patterns": ["Microservices", "Event Driven", "REST", "SOA", "Monolithic"],
  "Security Technologies": ["OAuth2", "JWT", "Spring Security", "IAM"],
  "Business Analysis": ["Requirements Gathering", "Requirement Analysis", "User Stories", "Acceptance Criteria", "BRD", "FRD", "Process Mapping", "Gap Analysis", "UAT", "Stakeholder Management", "Jira", "Confluence"],
  "Workday": ["Workday HCM", "Workday Financials", "Workday Studio", "Workday EIB", "Workday Core HCM", "Workday Recruiting", "Workday Payroll", "Workday Security", "Business Process Configuration", "Calculated Fields", "Custom Reports", "Tenant Management"],
  "Product Management": ["Product Roadmap", "Backlog Management", "Sprint Planning", "Prioritization", "User Research", "Release Planning", "Product Strategy", "KPI", "OKR"],
  "Data and Reporting": ["Data Analysis", "Reporting", "Dashboards", "Power BI", "Tableau", "Excel", "Data Mapping"],
  "Operations and Governance": ["Incident Management", "Change Management", "Release Management", "Compliance", "Risk Management", "Governance", "SLA"]
};

const defaultProjects = [
  {
    clientName: "CVS Health, USA",
    designation: "Senior Sitecore Developer",
    domain: "Healthcare",
    cloud: "AWS"
  },
  {
    clientName: "World Kinect Corporation, USA",
    designation: "Sitecore Developer",
    domain: "Logistics",
    cloud: "AWS"
  },
  {
    clientName: "Infosys - CISCO, India",
    designation: "Software Engineer",
    domain: "Telecom",
    cloud: ""
  },
  {
    clientName: "TCS - Ericsson, India",
    designation: "Associate Software Engineer",
    domain: "Telecom",
    cloud: ""
  }
];

function addProject(values = {}) {
  const node = projectTemplate.content.firstElementChild.cloneNode(true);
  for (const [key, value] of Object.entries(values)) {
    const input = node.querySelector(`[name="${key}"]`);
    if (input) input.value = value;
  }
  node.querySelector(".remove-project").addEventListener("click", () => {
    if (projectsEl.children.length > 1) {
      node.remove();
      alignProjectTimeline();
      markDraftChanged();
    }
  });
  projectsEl.appendChild(node);
  alignProjectTimeline();
}

function collectProjects() {
  return [...projectsEl.querySelectorAll(".project-card")].map((card, index) => {
    const values = {};
    [...card.querySelectorAll("input")].forEach((input) => {
      values[input.name] = input.value.trim();
    });
    values.duration = card.dataset.duration || "";
    values.sequence = index;
    return values;
  }).filter((project) => project.clientName);
}

function createResumeContext(data) {
  const projects = collectProjects().map((project, index) => ({
    clientName: project.clientName,
    designation: project.designation,
    domain: project.domain,
    duration: project.duration,
    cloud: project.cloud,
    sequence: index
  }));
  const targetJobTitle = cleanRoleTitle(data.jobTitle);
  const yearsOfExperience = Number(data.years);
  return {
    candidateName: String(data.candidateName || "").trim(),
    jobTitle: targetJobTitle,
    years: String(data.years || "").trim(),
    targetJobTitle,
    yearsOfExperience,
    jobDescription: String(data.jobDescription || "").trim(),
    clients: projects.map((project) => project.clientName),
    domains: projects.map((project) => project.domain),
    durations: projects.map((project) => project.duration),
    projects,
    skills: [],
    template: String(data.template || "")
  };
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function skillMatchesFromText(text) {
  const source = normalize(text);
  return Object.entries(skillBank).reduce((matches, [category, skills]) => {
    const found = unique(skills.filter((skill) => source.includes(skill.toLowerCase())));
    if (found.length) matches[category] = found;
    return matches;
  }, {});
}

function profileTextFromContext(resumeContext, projects = resumeContext.projects || []) {
  return [
    resumeContext.template,
    resumeContext.targetJobTitle,
    ...projects.flatMap((project) => [
      project.clientName,
      project.designation,
      project.domain,
      project.cloud
    ])
  ].join(" ");
}

function roleTransferableTerms(roleTrack) {
  const map = {
    businessAnalysis: ["Requirements Analysis", "User Stories", "Acceptance Criteria", "UAT", "Process Mapping", "Gap Analysis", "Stakeholder Management", "Jira", "Confluence", "Reporting", "Data Validation"],
    workday: ["Stakeholder Management", "Reporting", "Data Validation", "Release Management", "Process Mapping", "Governance"],
    devops: ["Monitoring", "Incident Management", "Release Management", "SLA", "Governance", "Change Management"],
    product: ["Backlog Management", "Sprint Planning", "Prioritization", "Release Planning", "KPI", "Stakeholder Management"],
    quality: ["UAT", "Test Strategy", "Defect Triage", "Release Validation", "Quality Improvement", "Automation Coverage"],
    data: ["Data Analysis", "Reporting", "Dashboards", "Data Mapping", "Data Validation", "KPI"],
    delivery: ["Release Management", "Change Management", "Risk Management", "Governance", "SLA", "Stakeholder Management"],
    technical: ["Release Management", "Production Support", "Performance Improvement", "Quality Improvement", "Data Validation"]
  };
  return map[roleTrack] || map.technical;
}

function analyzeResumeTarget(jobTitle, jobDescription, years) {
  const roleTrack = inferRoleTrack(jobTitle);
  const jobMap = analyzeJob(jobDescription);
  const groups = detectJobKeywordGroups(jobDescription);
  const allSkills = unique([
    ...groups.requiredSkills,
    ...groups.preferredSkills,
    ...groups.technicalKeywords,
    ...groups.toolsPlatformsMethodologies
  ]);
  return {
    roleCategory: roleTrack,
    seniorityLevel: careerLevel(Number(years), 0, 1),
    coreResponsibilities: unique([
      ...groups.businessKeywords,
      ...groups.softSkills,
      ...roleArtifacts(roleTrack).slice(0, 4)
    ]),
    primarySkills: allSkills.slice(0, 10),
    secondarySkills: unique([
      ...groups.preferredSkills,
      ...groups.toolsPlatformsMethodologies,
      ...groups.softSkills
    ]).slice(0, 10),
    domainKnowledge: groups.domainKeywords,
    jobMap
  };
}

function classifySkillFit(requirements, candidateSkills, profileText, roleTrack) {
  const profile = normalize(profileText);
  const candidateSkillSet = unique(candidateSkills);
  const transferableTerms = roleTransferableTerms(roleTrack);
  const existing = [];
  const transferable = [];
  const missing = [];

  unique(requirements).forEach((skill) => {
    const normalized = normalize(skill);
    const category = skillCategory(skill);
    const hasExactSkill = candidateSkillSet.some((candidateSkill) => normalize(candidateSkill) === normalized);
    const hasProfileEvidence = normalized && profile.includes(normalized);
    const hasSameCategory = category && candidateSkillSet.some((candidateSkill) => skillCategory(candidateSkill) === category);
    const hasRoleTransfer = transferableTerms.some((term) => normalize(term) === normalized);
    const isBusinessConcept = /stakeholder|business|customer|quality|performance|release|communication|collaboration|leadership|ownership|problem|agile|healthcare|telecom|logistics|finance|banking|content management/i.test(skill);

    if (hasExactSkill || hasProfileEvidence) {
      existing.push(skill);
    } else if (hasSameCategory || hasRoleTransfer || isBusinessConcept) {
      transferable.push(skill);
    } else {
      missing.push(skill);
    }
  });

  return {
    existing,
    transferable,
    missing,
    allowedTerms: unique([...existing, ...transferable]),
    resumeSafeTerms: unique([
      ...existing,
      ...transferable.filter((skill) => !skillCategory(skill))
    ])
  };
}

function transferablesByCategory(classification) {
  const grouped = {};
  (classification.transferable || []).forEach((skill) => {
    if (skillCategory(skill)) return;
    const category = skillCategory(skill) || "Transferable Role Capabilities";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(skill);
  });
  return Object.fromEntries(Object.entries(grouped).map(([category, skills]) => [category, unique(skills)]));
}

function mergeSkillGroups(primary, secondary) {
  const merged = { ...primary };
  Object.entries(secondary || {}).forEach(([category, skills]) => {
    merged[category] = unique([...(merged[category] || []), ...skills]);
  });
  return Object.fromEntries(Object.entries(merged).filter(([, skills]) => skills.length));
}

function xmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipEntry(file, entryName) {
  if (!("DecompressionStream" in window)) {
    throw new Error("DOCX extraction needs a browser with built-in decompression support.");
  }
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;

  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (readUint32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Could not read DOCX package.");

  const centralSize = readUint32(view, eocd + 12);
  const centralOffset = readUint32(view, eocd + 16);
  let offset = centralOffset;
  const decoder = new TextDecoder();

  while (offset < centralOffset + centralSize) {
    if (readUint32(view, offset) !== 0x02014b50) break;
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (fileName === entryName) {
      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      const content = method === 0 ? compressed : await inflateRaw(compressed);
      return decoder.decode(content);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`Could not find ${entryName} in DOCX.`);
}

async function readZipEntries(buffer) {
  if (!("DecompressionStream" in window)) {
    throw new Error("DOCX download needs a browser with built-in decompression support.");
  }
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  const decoder = new TextDecoder();

  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (readUint32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Could not read DOCX package.");

  const centralSize = readUint32(view, eocd + 12);
  const centralOffset = readUint32(view, eocd + 16);
  let offset = centralOffset;
  const entries = [];

  while (offset < centralOffset + centralSize) {
    if (readUint32(view, offset) !== 0x02014b50) break;
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : await inflateRaw(compressed);
    entries.push({ name, data });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function createZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, 0);
    writeUint16(local, 8, 0);
    writeUint16(local, 10, dosTime);
    writeUint16(local, 12, dosDate);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, data.length);
    writeUint32(local, 22, data.length);
    writeUint16(local, 26, nameBytes.length);
    writeUint16(local, 28, 0);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, 0);
    writeUint16(central, 10, 0);
    writeUint16(central, 12, dosTime);
    writeUint16(central, 14, dosDate);
    writeUint32(central, 16, crc);
    writeUint32(central, 20, data.length);
    writeUint32(central, 24, data.length);
    writeUint16(central, 28, nameBytes.length);
    writeUint16(central, 30, 0);
    writeUint16(central, 32, 0);
    writeUint16(central, 34, 0);
    writeUint16(central, 36, 0);
    writeUint32(central, 38, 0);
    writeUint32(central, 42, localOffset);
    central.set(nameBytes, 46);

    localParts.push(local);
    centralParts.push(central);
    localOffset += local.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22);
  writeUint32(eocd, 0, 0x06054b50);
  writeUint16(eocd, 8, entries.length);
  writeUint16(eocd, 10, entries.length);
  writeUint32(eocd, 12, centralDirectory.length);
  writeUint32(eocd, 16, localOffset);

  return concatBytes([...localParts, centralDirectory, eocd]);
}

async function extractDocxText(file) {
  const xml = await unzipEntry(file, "word/document.xml");
  return xmlToText(xml);
}

async function extractPdfText(file) {
  const raw = await file.text();
  const strings = [];
  const literalStrings = raw.match(/\((?:\\.|[^\\)]){2,}\)/g) || [];
  literalStrings.forEach((value) => {
    strings.push(value.slice(1, -1).replace(/\\[nrt]/g, " ").replace(/\\([()\\])/g, "$1"));
  });
  const hexStrings = raw.match(/<([0-9A-Fa-f]{8,})>/g) || [];
  hexStrings.forEach((value) => {
    const hex = value.slice(1, -1);
    let text = "";
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code && code < 65535) text += String.fromCharCode(code);
    }
    if (text.trim()) strings.push(text);
  });
  return strings.join(" ").replace(/\s{2,}/g, " ").trim();
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return extractDocxText(file);
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files are binary Word files. Please save as .docx for accurate extraction.");
  }
  return file.text();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphPlainText(paragraphXml) {
  return xmlToText(paragraphXml).replace(/\s+/g, " ").trim();
}

function stripBulletPrefix(text) {
  return String(text).replace(/^\s*[-•]\s+/, "").trim();
}

function paragraphHasNativeList(paragraphXml) {
  return paragraphXml.includes("<w:numPr>");
}

function nextWordHexId() {
  generatedParagraphId = (generatedParagraphId + 1) >>> 0;
  return generatedParagraphId.toString(16).toUpperCase().padStart(8, "0");
}

function refreshWordParagraphIds(paragraphXml) {
  return paragraphXml
    .replace(/w14:paraId="[^"]*"/, `w14:paraId="${nextWordHexId()}"`)
    .replace(/w14:textId="[^"]*"/, `w14:textId="${nextWordHexId()}"`);
}

function applyBulletIndent(paragraphXml) {
  const indent = '<w:ind w:left="360" w:hanging="360"/>';
  if (paragraphXml.includes("<w:ind ")) {
    return paragraphXml.replace(/<w:ind\b[^/]*\/>/, indent);
  }
  if (paragraphXml.includes("</w:pPr>")) {
    return paragraphXml.replace("</w:pPr>", `${indent}</w:pPr>`);
  }
  return paragraphXml.replace(/(<w:p\b[^>]*>)/, `$1<w:pPr>${indent}</w:pPr>`);
}

function paragraphWithText(templateParagraph, text, options = {}) {
  const hasNativeList = paragraphHasNativeList(templateParagraph);
  const value = options.bullet
    ? `${hasNativeList ? "" : "• "}${stripBulletPrefix(text)}`
    : text;
  const paragraph = refreshWordParagraphIds(options.bullet && !hasNativeList
    ? applyBulletIndent(templateParagraph)
    : templateParagraph);
  let usedFirstTextNode = false;
  return paragraph.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (match, open, current, close) => {
    if (usedFirstTextNode) return `${open}${close}`;
    usedFirstTextNode = true;
    return `${open}${escapeXml(value)}${close}`;
  });
}

function replaceParagraphsContaining(xml, marker, lines, options = {}) {
  let replaced = false;
  const usefulLines = lines.filter((line) => line.trim());
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced || !paragraphPlainText(paragraph).includes(marker)) return paragraph;
    replaced = true;
    return usefulLines.map((line) => paragraphWithText(paragraph, line, options)).join("");
  });
}

function replaceAllParagraphsContaining(xml, marker, lineGroups, options = {}) {
  let groupIndex = 0;
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!paragraphPlainText(paragraph).includes(marker)) return paragraph;
    const lines = lineGroups[groupIndex] || [];
    groupIndex += 1;
    return lines.filter((line) => line.trim()).map((line) => paragraphWithText(paragraph, line, options)).join("");
  });
}

function replaceSequentialParagraphs(xml, predicate, lines) {
  let index = 0;
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!predicate(paragraphPlainText(paragraph)) || index >= lines.length) return paragraph;
    const line = lines[index];
    index += 1;
    return paragraphWithText(paragraph, line);
  });
}

function replaceFirstContentParagraph(xml, value) {
  if (!value || normalize(xmlToText(xml)).includes(normalize(value))) return xml;
  let replaced = false;
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced) return paragraph;
    const text = paragraphPlainText(paragraph).trim();
    if (!text || /^(summary|professional summary|it skills|technical skills|skills|work experience|professional experience|experience|client|role|responsibilities)\s*:?$/i.test(text)) {
      return paragraph;
    }
    replaced = true;
    return paragraphWithText(paragraph, value);
  });
}

function replaceTextAnywhere(xml, marker, value) {
  return xml.replaceAll(escapeXml(marker), escapeXml(value));
}

function paragraphPlaceholderCount(xml, marker) {
  let count = 0;
  xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (paragraphPlainText(paragraph).includes(marker)) count += 1;
    return paragraph;
  });
  return count;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window
  }));
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1500);
}

async function buildDocxFromUploadedTemplate(artifacts) {
  if (!uploadedDocxTemplate) return null;
  const entries = await readZipEntries(uploadedDocxTemplate.buffer.slice(0));
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  if (!documentEntry) throw new Error("The uploaded DOCX template does not contain a document body.");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let xml = decoder.decode(documentEntry.data);
  const beforePlaceholderCount = paragraphPlaceholderCount(xml, "[Insert Bullet points Here]");
  [
    "[Insert Candidate Name Here]",
    "[Candidate Name Here]",
    "Candidate Name Here",
    "{{candidateName}}",
    "{{candidate name}}",
    "[[candidate name]]"
  ].forEach((marker) => {
    xml = replaceTextAnywhere(xml, marker, artifacts.candidateName || "");
  });
  xml = replaceFirstContentParagraph(xml, artifacts.candidateName || "");
  xml = replaceTextAnywhere(xml, "[Insert Job Title Here]", artifacts.jobTitle);
  xml = replaceTextAnywhere(xml, "[Target Job Title Here]", artifacts.jobTitle);
  xml = replaceSequentialParagraphs(
    xml,
    (text) => text.startsWith("Client:"),
    artifacts.projectBlocks.map((project) => `Client: ${project.clientName}                             ${project.duration}`)
  );
  xml = replaceAllParagraphsContaining(
    xml,
    "[Client Here]",
    artifacts.projectBlocks.map((project) => [`Client: ${project.clientName}                             ${project.duration}`])
  );
  xml = replaceAllParagraphsContaining(
    xml,
    "[Role Here]",
    artifacts.projectBlocks.map((project) => [`Role: ${project.role}`])
  );
  xml = replaceSequentialParagraphs(
    xml,
    (text) => text.startsWith("Role:"),
    artifacts.projectBlocks.map((project) => `Role: ${project.role}`)
  );
  xml = replaceParagraphsContaining(xml, "[Insert Skill Matrix Here]", artifacts.skillLines);
  xml = replaceAllParagraphsContaining(xml, "[Insert Bullet points Here]", [
    artifacts.summaryLines,
    ...artifacts.projectBlocks.map((project) => project.bullets)
  ], { bullet: true });
  const afterPlaceholderCount = paragraphPlaceholderCount(xml, "[Insert Bullet points Here]");
  if (beforePlaceholderCount > 0 && afterPlaceholderCount >= beforePlaceholderCount) {
    throw new Error("The DOCX placeholders were not replaced. Please confirm the template contains marked placeholder text.");
  }

  documentEntry.data = encoder.encode(xml);
  return new Blob([createZip(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function detectSkills(resumeContext, projects, jobKeywordGroups) {
  const profileText = profileTextFromContext(resumeContext, projects);
  const grouped = skillMatchesFromText(profileText);

  const addSkills = (category, skills) => {
    grouped[category] = unique([...(grouped[category] || []), ...skills]);
  };

  if (projects.some((project) => project.cloud)) {
    addSkills("Cloud Platforms", unique(projects.map((project) => project.cloud)).filter(Boolean));
  }

  const requirements = unique([
    ...jobKeywordGroups.requiredSkills,
    ...jobKeywordGroups.preferredSkills,
    ...jobKeywordGroups.technicalKeywords,
    ...jobKeywordGroups.toolsPlatformsMethodologies,
    ...jobKeywordGroups.businessKeywords,
    ...jobKeywordGroups.softSkills,
    ...jobKeywordGroups.domainKeywords
  ]);
  const existingSkills = flattenGroupedSkills(grouped);
  const classification = classifySkillFit(
    requirements,
    existingSkills,
    profileText,
    inferRoleTrack(resumeContext.targetJobTitle)
  );
  const transferableGroups = transferablesByCategory(classification);
  const merged = mergeSkillGroups(grouped, transferableGroups);

  return {
    groupedSkills: merged,
    profileText,
    classification
  };
}

function analyzeJob(jobDescription) {
  const text = normalize(jobDescription);
  return {
    leadership: /lead|mentor|stakeholder|architect|ownership|senior/.test(text),
    testing: /test|junit|mockito|jest|cypress|selenium/.test(text),
    devops: /ci\/cd|jenkins|docker|kubernetes|devops|pipeline|azure devops/.test(text),
    cms: /sitecore|cms|content|experience platform|sxa|helix/.test(text),
    integration: /api|integration|third.?party|service|rest|graphql/.test(text),
    search: /solr|coveo|search/.test(text)
  };
}

function careerLevel(years, projectIndex, totalProjects) {
  const recent = projectIndex === 0;
  if (years >= 8 && recent) return "lead";
  if (years >= 6 && projectIndex <= 1) return "senior";
  if (years >= 3 && projectIndex < totalProjects - 1) return "mid";
  return "early";
}

function suggestedDesignation(years, index, targetJobTitle = form.elements.jobTitle.value) {
  const roleFamily = cleanRoleTitle(targetJobTitle);
  if (index === 0 && years >= 8) return `Lead ${roleFamily}`;
  if (index <= 1 && years >= 5) return `Senior ${roleFamily}`;
  if (index <= 2 && years >= 2) return roleFamily;
  return `Junior ${roleFamily}`;
}

function isSeedOrGenericDesignation(value) {
  return !String(value || "").trim() ||
    /^(associate software engineer|software engineer|sitecore developer|senior sitecore developer)$/i.test(String(value).trim());
}

function resolveProjectRole(project, years, index, targetJobTitle) {
  return isSeedOrGenericDesignation(project.designation)
    ? suggestedDesignation(years, index, targetJobTitle)
    : project.designation;
}

function cleanRoleTitle(value) {
  const role = String(value || "").replace(/\s+/g, " ").trim();
  return role || "Professional";
}

function formatMonth(date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function distributeMonths(totalMonths, count) {
  if (count <= 0) return [];
  if (totalMonths < count * 3) return Array.from({ length: count }, () => 3);
  const weights = Array.from({ length: count }, (_, index) => Math.max(1, count - index));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => Math.max(6, Math.round((totalMonths * weight) / totalWeight)));
  let diff = totalMonths - raw.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (diff !== 0 && raw.length) {
    const step = diff > 0 ? 1 : -1;
    if (raw[index] + step >= 3) {
      raw[index] += step;
      diff -= step;
    }
    index = (index + 1) % raw.length;
  }
  return raw;
}

function alignProjectTimeline() {
  const cards = [...projectsEl.querySelectorAll(".project-card")];
  if (!cards.length) return;
  if (!yearsInput.value.trim()) {
    cards.forEach((card) => {
      delete card.dataset.duration;
    });
    return;
  }
  const years = Math.max(0, Number(yearsInput.value || 0));
  const durations = distributeMonths(Math.max(1, Math.round(years * 12)), cards.length);
  let end = new Date();

  cards.forEach((card, index) => {
    const months = durations[index] || 6;
    const start = addMonths(end, -months + 1);
    const designationInput = card.querySelector('[name="designation"]');
    card.dataset.duration = `${formatMonth(start)} - ${index === 0 ? "Present" : formatMonth(end)}`;
    if (isSeedOrGenericDesignation(designationInput.value)) {
      designationInput.value = suggestedDesignation(years, index);
    }
    end = addMonths(start, -1);
  });
}

function buildSummary({ jobTitle, years, projects, groupedSkills, jobDescription, skillClassification = {}, correctionTerms = [] }) {
  const domains = unique(projects.map((project) => project.domain)).slice(0, 3).join(", ");
  const skills = flattenGroupedSkills(groupedSkills).slice(0, 12);
  const role = cleanRoleTitle(jobTitle);
  const roleTrack = inferRoleTrack(role);
  const value = roleValuePhraseForContext(roleTrack, skillClassification);
  const artifacts = authenticRoleArtifacts(roleTrack, skillClassification);
  const allowedTerms = skillClassification.resumeSafeTerms || skillClassification.allowedTerms || [];
  const keywordBridge = unique([summaryKeywordBridge(jobDescription), ...correctionTerms]
    .flatMap((item) => String(item || "").split(",").map((part) => part.trim())))
    .filter((item) => !allowedTerms.length || allowedTerms.some((term) => normalize(term) === normalize(item)) || !skillCategory(item))
    .filter(Boolean)
    .slice(0, 12)
    .join(", ");

  return [
    `- ${role} with ${years}+ years of experience delivering ${value} across ${domains || "business-critical domains"}.`,
    `- Applies ${skills.slice(0, 8).join(", ") || "role-aligned practices"} to translate target-role requirements into practical outcomes, clear deliverables, and measurable execution discipline.`,
    `- Uses ${artifacts.slice(0, 5).join(", ")}${artifacts.length > 5 ? `, and ${artifacts.slice(5).join(", ")}` : ""} to show role alignment through existing and transferable experience rather than unsupported keyword insertion.`,
    `- Strengthens ${keywordBridge || "business alignment, communication, collaboration, and release readiness"} through stakeholder collaboration, structured analysis, delivery ownership, quality validation, and continuous improvement.`
  ].join("\n");
}

function summaryLines({ jobTitle, years, projects, groupedSkills, jobDescription, skillClassification = {}, correctionTerms = [] }) {
  return buildSummary({ jobTitle, years, projects, groupedSkills, jobDescription, skillClassification, correctionTerms }).split("\n");
}

function buildSkillMatrix(groupedSkills, jobDescription = "") {
  const jd = normalize(jobDescription);
  return Object.entries(groupedSkills)
    .map(([category, skills]) => {
      const orderedSkills = [...skills].sort((left, right) => {
        const leftIndex = jd.indexOf(left.toLowerCase());
        const rightIndex = jd.indexOf(right.toLowerCase());
        if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });
      const relevance = orderedSkills.reduce((score, skill) => score + (jd.includes(skill.toLowerCase()) ? 1 : 0), 0);
      return { category, skills: orderedSkills, relevance };
    })
    .sort((left, right) => {
      if (right.relevance !== left.relevance) return right.relevance - left.relevance;
      return left.category.localeCompare(right.category);
    })
    .map(({ category, skills }) => `${category}: ${skills.join(", ")}`)
    .join("\n");
}

function summaryKeywordBridge(jobDescription) {
  const groups = detectJobKeywordGroups(jobDescription);
  return unique([
    ...groups.businessKeywords,
    ...groups.softSkills,
    ...groups.domainKeywords
  ]).slice(0, 8).join(", ");
}

function inferRoleTrack(jobTitle) {
  const title = normalize(jobTitle);
  if (/business analyst|ba\b|systems analyst|functional analyst/.test(title)) return "businessAnalysis";
  if (/workday|hcm consultant|workday consultant|workday analyst/.test(title)) return "workday";
  if (/devops|sre|site reliability|platform engineer|cloud engineer/.test(title)) return "devops";
  if (/product owner|product manager|scrum product/.test(title)) return "product";
  if (/qa|quality|test engineer|automation tester/.test(title)) return "quality";
  if (/data|analytics|bi developer|reporting/.test(title)) return "data";
  if (/project manager|program manager|scrum master/.test(title)) return "delivery";
  return "technical";
}

function roleValuePhrase(roleTrack) {
  return {
    businessAnalysis: "requirements analysis, process improvement, stakeholder alignment, UAT readiness, and business workflow optimization",
    workday: "Workday configuration, tenant readiness, business process optimization, security validation, reporting, and HRIS stakeholder enablement",
    devops: "automation, CI/CD reliability, cloud operations, deployment governance, monitoring, and incident response",
    product: "roadmap execution, backlog prioritization, stakeholder communication, release planning, and product outcome alignment",
    quality: "test strategy, defect prevention, automation coverage, release validation, and quality improvement",
    data: "data analysis, reporting, dashboard insights, data mapping, and decision-support outcomes",
    delivery: "delivery planning, team coordination, governance, risk management, and release execution",
    technical: "solution delivery, system enhancement, integration readiness, production support, and cross-functional execution"
  }[roleTrack] || "target-role delivery";
}

function roleValuePhraseForContext(roleTrack, classification = {}) {
  const existingText = normalize([...(classification.existing || []), ...(classification.transferable || [])].join(" "));
  if (roleTrack === "workday" && !/workday|hcm|tenant|payroll|calculated fields|eib/.test(existingText)) {
    return "business process analysis, reporting validation, stakeholder enablement, release readiness, and operational workflow improvement";
  }
  if (roleTrack === "devops" && !/ci\/cd|docker|kubernetes|terraform|jenkins|azure devops|github actions|monitoring/.test(existingText)) {
    return "release coordination, production support, monitoring awareness, incident triage, and operational reliability improvement";
  }
  return roleValuePhrase(roleTrack);
}

function authenticRoleArtifacts(roleTrack, classification = {}) {
  const allowed = unique([...(classification.existing || []), ...(classification.transferable || [])]);
  const allowedText = normalize(allowed.join(" "));
  const hasWorkdayEvidence = /workday|hcm|tenant|payroll|calculated fields|eib|security groups/.test(allowedText);
  const hasDevopsEvidence = /ci\/cd|docker|kubernetes|terraform|jenkins|azure devops|github actions|monitoring|incident management/.test(allowedText);
  const fallback = {
    businessAnalysis: ["Requirements Analysis", "User Stories", "Acceptance Criteria", "UAT", "Process Flows", "Data Validation", "Reporting"],
    workday: ["Business Process Configuration", "Custom Reports", "Tenant Testing", "Data Validation", "Reporting", "Release Readiness"],
    devops: ["CI/CD", "Monitoring", "Incident Resolution", "Reliability Metrics", "Runbooks", "Release Gates"],
    product: ["Backlog", "Sprint Goals", "Acceptance Criteria", "Release Notes", "KPI Reviews"],
    quality: ["Test Strategy", "Defect Triage", "UAT Evidence", "Release Validation", "Quality Metrics"],
    data: ["Data Mapping", "Dashboards", "Reporting", "Data Validation", "KPI Definitions"],
    delivery: ["Delivery Plan", "Risk Register", "Release Plan", "Status Reporting", "SLA Dashboard"],
    technical: ["APIs", "Database Optimization", "Performance Tuning", "Integration Contracts", "Code Reviews", "Release Validation"]
  };
  const direct = roleArtifacts(roleTrack).filter((artifact) => allowedText.includes(normalize(artifact)));
  const safeGeneric = ["Stakeholder Management", "Process Improvement", "Data Validation", "Reporting", "Release Readiness", "Release Validation", "Quality Metrics", "Status Reporting", "Risk Register"];
  if (roleTrack === "workday" && !hasWorkdayEvidence) {
    return ["Stakeholder Management", "Process Mapping", "Data Validation", "Reporting", "Release Readiness"];
  }
  if (roleTrack === "devops" && !hasDevopsEvidence) {
    return ["Release Management", "Incident Management", "Monitoring", "SLA Dashboard", "Governance"];
  }
  const transferable = (fallback[roleTrack] || fallback.technical).filter((artifact) => {
    const category = skillCategory(artifact);
    return allowedText.includes(normalize(artifact)) ||
      safeGeneric.includes(artifact) ||
      (category && allowed.some((term) => skillCategory(term) === category));
  });
  const result = unique([...direct, ...transferable]).slice(0, 8);
  return result.length ? result : ["Stakeholder Management", "Process Improvement", "Data Validation", "Reporting", "Release Readiness"];
}

function authenticRoleActions(roleTrack, maturity, classification = {}) {
  const allowedText = normalize([...(classification.existing || []), ...(classification.transferable || [])].join(" "));
  const hasWorkdayEvidence = /workday|hcm|tenant|payroll|calculated fields|eib|security groups/.test(allowedText);
  const hasDevopsEvidence = /ci\/cd|docker|kubernetes|terraform|jenkins|azure devops|github actions|monitoring|incident management/.test(allowedText);
  if (roleTrack === "workday" && !hasWorkdayEvidence) {
    return roleActions("businessAnalysis", maturity);
  }
  if (roleTrack === "devops" && !hasDevopsEvidence) {
    return roleActions("delivery", maturity);
  }
  return roleActions(roleTrack, maturity);
}

function domainTerms(domain) {
  const text = normalize(domain);
  if (/health|medical|care|pharma|cvs/.test(text)) {
    return ["claims", "member services", "patient data", "compliance", "care operations"];
  }
  if (/logistics|supply|transport|inventory|operations|kinect/.test(text)) {
    return ["supply chain", "transportation", "inventory", "operations", "order movement"];
  }
  if (/telecom|network|ericsson|cisco|connectivity/.test(text)) {
    return ["network operations", "customer services", "provisioning", "connectivity", "service assurance"];
  }
  if (/finance|bank|payment|insurance/.test(text)) {
    return ["transactions", "risk controls", "customer accounts", "compliance", "financial operations"];
  }
  return ["business operations", "customer workflows", "operational data", "service delivery", "process controls"];
}

function domainProfile(domain) {
  const text = normalize(domain);
  if (/health|medical|care|pharma|cvs/.test(text)) {
    return {
      workflow: "claims adjudication, member services, patient data validation, and compliance intake",
      stakeholders: "product owners, compliance analysts, care operations leads, QA, and release teams",
      evidence: "claims exception reports, member-service workflow maps, audit notes, and UAT sign-off logs"
    };
  }
  if (/logistics|supply|transport|inventory|operations|kinect/.test(text)) {
    return {
      workflow: "supply chain visibility, transportation planning, inventory movement, and operations support",
      stakeholders: "operations managers, warehouse coordinators, product owners, QA, and integration teams",
      evidence: "inventory reconciliation reports, transportation process flows, exception logs, and SLA dashboards"
    };
  }
  if (/telecom|network|ericsson|cisco|connectivity/.test(text)) {
    return {
      workflow: "network operations, customer provisioning, connectivity assurance, and service recovery",
      stakeholders: "network operations teams, provisioning leads, support managers, QA, and release coordinators",
      evidence: "provisioning reports, incident trends, connectivity dashboards, and service assurance checklists"
    };
  }
  if (/finance|bank|payment|insurance/.test(text)) {
    return {
      workflow: "transaction controls, account servicing, risk review, and regulatory reporting",
      stakeholders: "operations leaders, risk analysts, finance product owners, QA, and release teams",
      evidence: "reconciliation reports, risk-control logs, audit samples, and transaction dashboards"
    };
  }
  return {
    workflow: "customer workflows, operational data, service delivery, and process controls",
    stakeholders: "business users, product owners, QA, DevOps, and delivery teams",
    evidence: "workflow maps, validation notes, operational reports, and release readiness checklists"
  };
}

function roleActions(roleTrack, maturity) {
  const map = {
    businessAnalysis: {
      early: ["Documented requirements", "Mapped workflows", "Validated user stories", "Supported UAT", "Analyzed defects", "Coordinated clarifications"],
      mid: ["Owned requirements analysis", "Facilitated workshops", "Refined acceptance criteria", "Optimized process flows", "Aligned stakeholders", "Validated release scope"],
      senior: ["Led discovery sessions", "Translated strategy into requirements", "Drove stakeholder decisions", "Governed UAT readiness", "Improved operating models", "Resolved requirement risks"],
      lead: ["Led business analysis strategy", "Established requirement governance", "Guided stakeholder alignment", "Prioritized business outcomes", "Mentored analysts", "Directed release readiness"]
    },
    workday: {
      early: ["Documented Workday requirements", "Mapped HR business processes", "Validated configuration changes", "Supported tenant testing", "Analyzed security issues", "Coordinated HRIS clarifications"],
      mid: ["Owned Workday configuration analysis", "Facilitated HRIS workshops", "Refined business process steps", "Optimized tenant workflows", "Aligned HR stakeholders", "Validated release readiness"],
      senior: ["Led Workday discovery sessions", "Translated HR strategy into configuration", "Drove tenant readiness decisions", "Governed security validation", "Improved HR operating models", "Resolved Workday release risks"],
      lead: ["Led Workday solution strategy", "Established configuration governance", "Guided HRIS stakeholder alignment", "Prioritized tenant outcomes", "Mentored Workday analysts", "Directed production readiness"]
    },
    devops: {
      early: ["Supported deployments", "Monitored environments", "Automated routine tasks", "Validated configurations", "Triaged incidents", "Documented runbooks"],
      mid: ["Owned CI/CD improvements", "Automated deployment workflows", "Optimized monitoring", "Improved release reliability", "Standardized environment controls", "Resolved operational issues"],
      senior: ["Designed automation strategy", "Led pipeline modernization", "Strengthened observability", "Improved incident response", "Governed cloud readiness", "Reduced deployment risk"],
      lead: ["Led DevOps operating model", "Directed platform reliability", "Established governance standards", "Mentored engineers", "Aligned automation roadmap", "Owned production resilience"]
    },
    product: {
      early: ["Supported backlog grooming", "Documented feature needs", "Tracked sprint priorities", "Validated user feedback", "Coordinated acceptance checks", "Prepared release notes"],
      mid: ["Owned backlog refinement", "Prioritized user stories", "Aligned stakeholder needs", "Defined release scope", "Analyzed adoption feedback", "Improved product workflows"],
      senior: ["Led roadmap planning", "Balanced business priorities", "Drove feature decisions", "Managed release tradeoffs", "Validated product outcomes", "Strengthened stakeholder cadence"],
      lead: ["Led product strategy execution", "Directed roadmap governance", "Owned prioritization framework", "Mentored product teams", "Aligned leadership stakeholders", "Measured product impact"]
    },
    quality: {
      early: ["Executed test scenarios", "Validated acceptance criteria", "Logged reproducible defects", "Supported regression cycles", "Prepared test evidence", "Coordinated QA clarifications"],
      mid: ["Owned test planning", "Expanded automation coverage", "Optimized regression scope", "Validated release readiness", "Analyzed defect patterns", "Improved quality checkpoints"],
      senior: ["Led quality strategy", "Drove automation standards", "Governed release validation", "Reduced defect leakage", "Aligned test coverage", "Mentored QA contributors"],
      lead: ["Directed quality operating model", "Established validation governance", "Owned release confidence", "Mentored quality teams", "Aligned risk-based testing", "Measured quality outcomes"]
    },
    data: {
      early: ["Prepared data mappings", "Validated report outputs", "Documented source-to-target rules", "Supported dashboard checks", "Reconciled data issues", "Coordinated reporting clarifications"],
      mid: ["Owned analysis workflows", "Built reporting logic", "Improved dashboard usability", "Validated data quality", "Translated KPI needs", "Streamlined insight delivery"],
      senior: ["Led analytics discovery", "Defined reporting standards", "Drove KPI alignment", "Improved data governance", "Resolved complex data gaps", "Guided insight adoption"],
      lead: ["Led data strategy execution", "Established reporting governance", "Directed analytics prioritization", "Mentored analysts", "Aligned executive insights", "Measured decision impact"]
    },
    delivery: {
      early: ["Tracked delivery tasks", "Coordinated sprint updates", "Documented risks", "Supported release planning", "Prepared status reporting", "Facilitated team follow-ups"],
      mid: ["Owned delivery coordination", "Managed sprint dependencies", "Improved planning cadence", "Aligned cross-functional teams", "Resolved delivery blockers", "Validated release scope"],
      senior: ["Led delivery governance", "Drove stakeholder decisions", "Managed program risks", "Optimized release execution", "Improved team throughput", "Strengthened communication cadence"],
      lead: ["Directed delivery operating model", "Established governance routines", "Owned leadership reporting", "Mentored delivery teams", "Aligned strategic priorities", "Measured program outcomes"]
    },
    technical: {
      early: ["Implemented assigned enhancements", "Validated application behavior", "Supported defect resolution", "Documented technical changes", "Coordinated with QA", "Assisted release checks"],
      mid: ["Owned feature delivery", "Integrated application workflows", "Optimized system behavior", "Clarified requirements", "Resolved production defects", "Supported release readiness"],
      senior: ["Designed scalable enhancements", "Led technical analysis", "Optimized performance", "Guided code quality", "Resolved complex issues", "Aligned delivery teams"],
      lead: ["Led solution delivery", "Directed technical roadmap execution", "Established design standards", "Mentored team members", "Owned release readiness", "Resolved critical production risks"]
    }
  };
  const selected = map[roleTrack] || map.technical;
  return selected[maturity] || selected.early;
}

function roleArtifacts(roleTrack) {
  const map = {
    businessAnalysis: ["BRD", "FRD", "User Stories", "Acceptance Criteria", "UAT", "Process Flows", "Data Validation", "Root Cause Analysis", "Reporting"],
    workday: ["Workday HCM", "Business Process Configuration", "Calculated Fields", "Custom Reports", "EIB", "Tenant Testing", "Security Groups", "Workday Recruiting", "Payroll Validation"],
    devops: ["CI/CD", "Infrastructure Automation", "Monitoring", "Incident Resolution", "Reliability Metrics", "Runbooks", "Release Gates", "Deployment Checklists"],
    product: ["Product Roadmap", "Backlog", "Sprint Goals", "Acceptance Criteria", "Release Notes", "User Feedback", "KPI Reviews", "Prioritization Matrix"],
    quality: ["Test Strategy", "Regression Suite", "Defect Triage", "Automation Coverage", "UAT Evidence", "Release Validation", "Risk-Based Testing", "Quality Metrics"],
    data: ["Data Mapping", "Dashboards", "Reporting", "Reconciliation Rules", "Data Validation", "KPI Definitions", "Source-to-Target Mapping", "Insight Briefs"],
    delivery: ["Delivery Plan", "Risk Register", "Dependency Tracker", "Release Plan", "Status Reporting", "Governance Deck", "SLA Dashboard", "Action Log"],
    technical: ["APIs", "Microservices", "Database Optimization", "Performance Tuning", "Integration Contracts", "Code Reviews", "Release Validation", "Production Support"]
  };
  return map[roleTrack] || map.technical;
}

function metricBank(roleTrack) {
  const map = {
    businessAnalysis: [
      "reduced requirement rework by 28%",
      "improved UAT pass rate from 86% to 96%",
      "cut manual validation effort by 18 hours per month",
      "improved reporting accuracy by 25%",
      "reduced stakeholder clarification cycles by 30%",
      "improved defect triage turnaround by 35%"
    ],
    workday: [
      "reduced configuration rework by 26%",
      "improved tenant testing pass rate from 87% to 96%",
      "cut HRIS validation effort by 16 hours per month",
      "improved report accuracy by 24%",
      "reduced security access exceptions by 30%",
      "improved release readiness from 90% to 98%"
    ],
    devops: [
      "reduced deployment rollback risk by 32%",
      "improved SLA compliance from 92% to 98%",
      "cut incident response time by 40%",
      "reduced manual release effort by 22 hours per month",
      "improved monitoring coverage by 30%",
      "reduced environment drift by 35%"
    ],
    product: [
      "improved sprint predictability by 24%",
      "reduced backlog aging by 30%",
      "increased feature acceptance rate by 22%",
      "cut release-scope churn by 26%",
      "improved stakeholder decision turnaround by 35%",
      "raised adoption visibility across 4 product KPIs"
    ],
    quality: [
      "reduced escaped defects by 40%",
      "improved regression coverage by 32%",
      "cut test-cycle effort by 20 hours per release",
      "improved release validation accuracy by 27%",
      "reduced defect reopening by 25%",
      "improved automation stability from 88% to 97%"
    ],
    data: [
      "improved reporting accuracy by 25%",
      "reduced reconciliation effort by 18 hours per month",
      "cut dashboard refresh delays by 30%",
      "improved data quality checks by 35%",
      "reduced manual report preparation by 22%",
      "increased KPI visibility across 5 operating metrics"
    ],
    delivery: [
      "improved SLA compliance from 92% to 98%",
      "reduced delivery blockers by 30%",
      "cut status-reporting effort by 12 hours per month",
      "improved release readiness by 28%",
      "reduced dependency delays by 25%",
      "increased sprint commitment reliability by 24%"
    ],
    technical: [
      "reduced API response time by 30%",
      "improved defect resolution time by 35%",
      "cut manual support effort by 20 hours per month",
      "improved release stability from 90% to 97%",
      "reduced database query latency by 28%",
      "improved production issue triage speed by 32%"
    ]
  };
  return map[roleTrack] || map.technical;
}

function rotatedItems(items, index, count) {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, offset) => items[(index + offset) % items.length]);
}

function variant(items, index) {
  return items[index % items.length];
}

function projectNarrativeFocus(project, index, maturity) {
  const terms = domainTerms(project.domain);
  const focusByMaturity = {
    early: ["execution support", "requirement clarity", "hands-on validation", "team follow-through"],
    mid: ["workflow ownership", "cross-functional coordination", "process optimization", "delivery predictability"],
    senior: ["stakeholder decisioning", "release confidence", "risk reduction", "business outcome alignment"],
    lead: ["strategic direction", "governance", "mentoring", "operating model improvement"]
  };
  const pool = focusByMaturity[maturity] || focusByMaturity.early;
  return {
    primary: pool[index % pool.length],
    secondary: pool[(index + 1) % pool.length],
    domain: terms[index % terms.length],
    outcome: terms[(index + 2) % terms.length]
  };
}

function stakeholderBullet({ project, role, profile, artifacts, index }) {
  return variant([
    () => `Partnered with ${profile.stakeholders} at ${project.clientName} to align ${role} decisions with ${profile.workflow}, using ${artifacts[0]} and ${artifacts[1]} to keep delivery grounded in real business needs.`,
    () => `At ${project.clientName}, translated stakeholder priorities from ${profile.stakeholders} into ${artifacts[0]}, ${artifacts[1]}, and delivery-ready decisions for ${profile.workflow}.`,
    () => `Facilitated working sessions with ${profile.stakeholders}, turning competing priorities at ${project.clientName} into a shared execution path for ${profile.workflow}.`,
    () => `Built stakeholder confidence for ${project.clientName} by clarifying scope, risks, and decisions across ${profile.stakeholders} before release commitments were finalized.`
  ], index)();
}

function processBullet({ actions, terms, profile, metrics, index }) {
  return variant([
    () => `${actions[1]} for ${terms[0]} and ${terms[1]} workflows, turning gaps found in ${profile.evidence} into process changes that ${metrics[0]}.`,
    () => `Improved the handoff between ${terms[0]} intake and ${terms[1]} validation by standardizing review checkpoints, which ${metrics[0]}.`,
    () => `${actions[4]} across ${profile.evidence}, then converted recurring blockers into process-flow updates that ${metrics[0]}.`,
    () => `Streamlined ${terms[0]} review routines by replacing ad hoc follow-ups with artifact-driven checkpoints, helping ${metrics[0]}.`
  ], index)();
}

function domainBullet({ project, artifacts, terms, focus, index }) {
  return variant([
    () => `Created domain-specific coverage for ${focus.domain} scenarios by connecting ${artifacts[2]}, ${terms[2]}, and ${focus.primary} so the project reflected how ${project.domain || "the business"} teams actually operated.`,
    () => `Mapped ${terms[2]} scenarios to ${artifacts[2]} and ${artifacts[3]}, giving ${project.domain || "business"} users clearer visibility into ${focus.domain} exceptions.`,
    () => `Grounded project decisions in ${project.domain || "business"} operations by validating ${focus.domain}, ${terms[2]}, and ${terms[3]} impacts before sprint scope was accepted.`,
    () => `Turned ${project.domain || "domain"} context into practical delivery guidance by documenting how ${focus.domain} issues affected ${terms[2]} and downstream ${terms[3]} controls.`
  ], index)();
}

function executionBullet({ actions, skillPhrase, cloud, metrics, index }) {
  return variant([
    () => `${actions[3]} using ${skillPhrase}${cloud ? ` in ${cloud}` : ""}, improving traceability from intake through release validation and helping ${metrics[1]}.`,
    () => `${actions[0]} with ${skillPhrase}${cloud ? ` across ${cloud}` : ""}, linking execution details to release evidence and helping ${metrics[1]}.`,
    () => `Applied ${skillPhrase} to move work from analysis into production-ready execution, strengthening validation discipline and helping ${metrics[1]}.`,
    () => `${actions[2]} through ${skillPhrase}${cloud ? ` on ${cloud}` : ""}, keeping business execution, quality checks, and release outcomes connected while helping ${metrics[1]}.`
  ], index)();
}

function improvementBullet({ terms, focus, index }) {
  return variant([
    () => `Converted root-cause findings, stakeholder feedback, and operational data into prioritized improvements for ${focus.outcome}, reducing repeated clarifications while protecting delivery quality.`,
    () => `Analyzed recurring defects and operational friction in ${terms[3]} workflows, then prioritized improvements that made ${focus.outcome} easier to validate.`,
    () => `Used feedback loops from QA, business users, and support teams to isolate root causes behind ${focus.outcome} issues and prevent repeat defects in later releases.`,
    () => `Reviewed process gaps affecting ${focus.outcome}, separated true defects from training or data issues, and converted the findings into clearer release actions.`
  ], index)();
}

function readinessBullet({ actions, focus, artifacts, index }) {
  return variant([
    () => `${actions[5]} with a focus on ${focus.secondary}, documenting decisions, risks, and readiness checkpoints so future releases could move without recreating the same analysis.`,
    () => `Maintained ${artifacts[0]} updates, decision notes, and readiness checkpoints so teams could reuse context instead of rediscovering prior analysis during each sprint.`,
    () => `${actions[5]} by capturing assumptions, risks, and validation evidence in plain business language that helped new team members understand ${focus.secondary}.`,
    () => `Closed each release cycle with practical documentation, open-risk notes, and lessons learned, making ${focus.secondary} visible to delivery and support teams.`
  ], index)();
}

function flattenGroupedSkills(groupedSkills) {
  return unique(Object.values(groupedSkills).flat());
}

function sentencesFrom(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectJobKeywordGroups(jobDescription) {
  const text = normalize(jobDescription);
  const grouped = {};
  for (const [category, skills] of Object.entries(skillBank)) {
    const matches = skills.filter((skill) => text.includes(skill.toLowerCase()));
    if (matches.length) grouped[category] = unique(matches);
  }

  const businessKeywords = unique([
    ["stakeholder", "Stakeholder Management"],
    ["requirements", "Requirements Analysis"],
    ["business", "Business Alignment"],
    ["customer", "Customer Experience"],
    ["production", "Production Support"],
    ["performance", "Performance Improvement"],
    ["quality", "Quality Improvement"],
    ["release", "Release Readiness"]
  ].filter(([needle]) => text.includes(needle)).map(([, label]) => label));

  const softSkills = unique([
    ["collaborat", "Collaboration"],
    ["communicat", "Communication"],
    ["lead", "Leadership"],
    ["mentor", "Mentoring"],
    ["ownership", "Ownership"],
    ["problem", "Problem Solving"],
    ["agile", "Agile Collaboration"]
  ].filter(([needle]) => text.includes(needle)).map(([, label]) => label));

  const domainKeywords = unique([
    ["health", "Healthcare"],
    ["telecom", "Telecom"],
    ["logistics", "Logistics"],
    ["retail", "Retail"],
    ["finance", "Finance"],
    ["bank", "Banking"],
    ["content", "Content Management"],
    ["commerce", "Commerce"]
  ].filter(([needle]) => text.includes(needle)).map(([, label]) => label));

  return {
    requiredSkills: unique(Object.values(grouped).flat()),
    preferredSkills: preferredKeywords(jobDescription),
    businessKeywords,
    technicalKeywords: unique([
      ...(grouped["Programming Languages"] || []),
      ...(grouped["Frameworks and CMS"] || []),
      ...(grouped["Databases"] || []),
      ...(grouped["Integration Technologies"] || []),
      ...(grouped["Search and Indexing"] || [])
    ]),
    toolsPlatformsMethodologies: unique([
      ...(grouped["Cloud Platforms"] || []),
      ...(grouped["DevOps Tools"] || []),
      ...(grouped["CI/CD Tools"] || []),
      ...(grouped["Testing Tools"] || []),
      ...(grouped["Monitoring Tools"] || []),
      ...(grouped["Version Control"] || []),
      ...(grouped["Methodologies"] || []),
      ...(grouped["Architecture Patterns"] || [])
    ]),
    softSkills,
    domainKeywords
  };
}

function preferredKeywords(jobDescription) {
  return unique(sentencesFrom(jobDescription)
    .filter((sentence) => /preferred|nice to have|plus|bonus|desired/i.test(sentence))
    .flatMap((sentence) => {
      const text = normalize(sentence);
      return Object.values(skillBank).flat().filter((skill) => text.includes(skill.toLowerCase()));
    }));
}

function candidateEvidenceText(data, projects, groupedSkills) {
  return normalize([
    data.jobTitle,
    ...flattenGroupedSkills(groupedSkills),
    ...projects.flatMap((project) => [project.clientName, project.domain, project.cloud])
  ].join(" "));
}

function skillCategory(skill) {
  return Object.keys(skillBank).find((category) => skillBank[category].includes(skill)) || "";
}

function classifyRequirement(keyword, candidateText, candidateSkills, classification = {}) {
  const normalized = normalize(keyword);
  if (!normalized) return "Missing";
  if ((classification.existing || []).some((skill) => normalize(skill) === normalized)) {
    return "Strong Match";
  }
  if ((classification.transferable || []).some((skill) => normalize(skill) === normalized)) {
    return "Partial Match";
  }
  if ((classification.missing || []).some((skill) => normalize(skill) === normalized)) {
    return "Missing";
  }
  if (candidateText.includes(normalized) || candidateSkills.some((skill) => normalize(skill) === normalized)) {
    return "Strong Match";
  }
  const category = skillCategory(keyword);
  if (category && candidateSkills.some((skill) => skillCategory(skill) === category)) {
    return "Partial Match";
  }
  return "Missing";
}

function requirementRows(data, projects, groupedSkills, jobKeywordGroups) {
  const candidateText = candidateEvidenceText(data, projects, groupedSkills);
  const candidateSkills = flattenGroupedSkills(groupedSkills);
  const requirements = unique([
    ...jobKeywordGroups.requiredSkills,
    ...jobKeywordGroups.preferredSkills,
    ...jobKeywordGroups.businessKeywords,
    ...jobKeywordGroups.toolsPlatformsMethodologies,
    ...jobKeywordGroups.softSkills,
    ...jobKeywordGroups.domainKeywords
  ]);

  return requirements.map((keyword) => ({
    keyword,
    status: classifyRequirement(keyword, candidateText, candidateSkills, data.skillClassification)
  }));
}

function atsMatchScore(rows) {
  if (!rows.length) return 0;
  const score = rows.reduce((sum, row) => {
    if (row.status === "Strong Match") return sum + 1;
    if (row.status === "Partial Match") return sum + 0.85;
    return sum;
  }, 0);
  return Math.round((score / rows.length) * 100);
}

function rowsByStatus(rows, status) {
  return rows.filter((row) => row.status === status).map((row) => row.keyword);
}

function safeMatchedTerms(rows, resumeContext) {
  const safe = resumeContext.skillClassification?.resumeSafeTerms || [];
  return rows
    .filter((row) => row.status !== "Missing")
    .map((row) => row.keyword)
    .filter((term) => !skillCategory(term) || safe.some((item) => normalize(item) === normalize(term)));
}

function contentContains(text, keyword) {
  return normalize(text).includes(normalize(keyword));
}

function scoreCoverage(items, text) {
  const terms = unique(items).filter(Boolean);
  if (!terms.length) return 100;
  const hits = terms.filter((item) => contentContains(text, item)).length;
  return Math.round((hits / terms.length) * 100);
}

function roleTerminology(roleTrack, classification = {}) {
  return authenticRoleArtifacts(roleTrack, classification);
}

function contaminationTerms(roleTrack) {
  const forbidden = {
    businessAnalysis: ["Spring Boot", "Microservices", "Kafka", "Kubernetes", "Terraform", "Workday Studio", "Workday EIB", "Java APIs"],
    workday: ["Spring Boot", "Microservices", "Java APIs", "Kafka", "Sitecore", "Coveo", "SXA", "Kubernetes"],
    devops: ["BRD", "FRD", "Workday HCM", "Calculated Fields", "Payroll Validation", "User Stories"],
    product: ["Spring Boot", "Terraform", "Workday Studio", "JUnit", "Mockito"],
    quality: ["Workday Studio", "Terraform", "Product Roadmap", "Payroll Validation"],
    data: ["Spring Boot", "Kubernetes", "Workday Studio", "Product Roadmap"],
    delivery: ["Spring Boot", "Workday Studio", "JUnit", "Mockito"],
    technical: ["Workday HCM", "Payroll Validation", "BRD", "FRD"]
  };
  return forbidden[roleTrack] || [];
}

function contaminationPenalty(roleTrack, resume, jobDescription, candidateProfileText = "") {
  const jd = normalize(jobDescription);
  const profile = normalize(candidateProfileText);
  return contaminationTerms(roleTrack)
    .filter((term) => contentContains(resume, term) && !jd.includes(term.toLowerCase()) && !profile.includes(term.toLowerCase()))
    .length * 8;
}

function bulletSimilarity(left, right) {
  const commonResumeTokens = [
    "with", "from", "that", "into", "using", "project", "release", "validation",
    "stakeholder", "stakeholders", "process", "workflow", "workflows", "delivery",
    "readiness", "evidence", "requirements", "business", "technical", "improved",
    "improving", "helping", "teams", "review", "reviews", "decision", "decisions",
    "support", "supported", "needs", "across", "through", "before", "after"
  ];
  const tokens = (text) => unique(normalize(text).match(/[a-z0-9]+/g) || [])
    .filter((token) => token.length > 3 && !commonResumeTokens.includes(token));
  const a = tokens(left);
  const b = tokens(right);
  if (!a.length || !b.length) return 0;
  const intersection = a.filter((token) => b.includes(token)).length;
  const union = unique([...a, ...b]).length;
  return intersection / union;
}

function duplicateScore(projectBlocks) {
  const bullets = projectBlocks.flatMap((project) => project.bullets);
  let maxSimilarity = 0;
  for (let left = 0; left < bullets.length; left += 1) {
    for (let right = left + 1; right < bullets.length; right += 1) {
      maxSimilarity = Math.max(maxSimilarity, bulletSimilarity(bullets[left], bullets[right]));
    }
  }
  if (maxSimilarity <= DUPLICATE_BULLET_THRESHOLD) return 100;
  return Math.max(70, Math.round(100 - ((maxSimilarity - DUPLICATE_BULLET_THRESHOLD) * 100)));
}

function findDuplicateBulletPairs(projectBlocks, threshold = DUPLICATE_BULLET_THRESHOLD) {
  const references = projectBlocks.flatMap((project, projectIndex) => (
    project.bullets.map((bullet, bulletIndex) => ({
      bullet,
      projectIndex,
      bulletIndex
    }))
  ));
  const pairs = [];
  for (let leftIndex = 0; leftIndex < references.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < references.length; rightIndex += 1) {
      const similarity = bulletSimilarity(references[leftIndex].bullet, references[rightIndex].bullet);
      if (similarity > threshold) {
        pairs.push({
          left: references[leftIndex],
          right: references[rightIndex],
          similarity
        });
      }
    }
  }
  return pairs.sort((left, right) => right.similarity - left.similarity);
}

function buildProjectText(project) {
  return `Client: ${project.clientName}                             ${project.duration}
Role: ${project.role}
Responsibilities:
${project.bullets.join("\n")}`;
}

function projectSpecificBullet(project, resumeContext, groupedSkills, bulletIndex, attempt) {
  const roleTrack = inferRoleTrack(resumeContext.targetJobTitle);
  const projectIndex = Number(project.sequence || 0);
  const maturity = careerLevel(Number(resumeContext.yearsOfExperience), projectIndex, resumeContext.projects.length);
  const actions = maturityActionSet(maturity);
  const artifacts = rotatedItems(authenticRoleArtifacts(roleTrack, resumeContext.skillClassification), projectIndex + bulletIndex + attempt, 4);
  const metrics = rotatedItems(metricBank(roleTrack), (projectIndex * 2) + bulletIndex + attempt, 2);
  const terms = domainTerms(project.domain);
  const profile = domainProfile(project.domain);
  const skills = rotatedItems(flattenGroupedSkills(groupedSkills), projectIndex + bulletIndex + attempt, 3);
  const skillPhrase = skills.length ? skills.join(", ") : "target-role practices";
  const role = project.role || resolveProjectRole(project, resumeContext.yearsOfExperience, projectIndex, resumeContext.targetJobTitle);
  const domain = project.domain || "business operations";
  const client = project.clientName;
  const artifact = artifacts[0] || "validation evidence";
  const improvementVariants = [
    `Reviewed ${terms[3]} defects at ${client}, separated data quality issues from workflow gaps, and converted the findings into ${artifact} updates that ${metrics[0]}.`,
    `Used ${profile.evidence} to isolate where ${terms[4]} handoffs were slowing the team, then adjusted review steps so ${client} could ${metrics[0]}.`,
    `Compared support notes, QA feedback, and ${terms[2]} trends for ${client}, turning recurring issues into clearer release actions that ${metrics[0]}.`,
    `Prioritized ${terms[0]} fixes for ${client} by ranking operational risk, user impact, and validation effort, which ${metrics[0]}.`
  ];
  const readinessVariants = [
    `Captured release notes, decision history, and ${terms[4]} assumptions for ${client} so support teams could trace why changes were accepted after handoff.`,
    `Packaged ${artifact}, risk notes, and validation examples for ${client}, giving future project teams a practical starting point for ${terms[3]} changes.`,
    `Documented open questions, known constraints, and ${terms[1]} acceptance evidence for ${client} to reduce repeat analysis in later sprints.`,
    `Summarized project decisions for ${client} in plain language, connecting ${terms[2]} tradeoffs to support, QA, and release follow-up work.`
  ];
  const domainDecisionVariants = [
    `Mapped ${terms[2]} exceptions for ${client} against ${artifacts[1]} and ${artifacts[2]}, giving ${domain} users a clearer view of ${terms[3]} impact before scope was accepted.`,
    `Translated ${domain} operating details at ${client} into sprint-ready guidance by showing how ${terms[2]} issues changed ${terms[3]} controls.`,
    `Validated ${terms[2]} scenarios for ${client} with ${artifacts[1]}, then used the findings to explain ${terms[3]} risk to delivery and QA teams.`,
    `Reviewed ${domain} workflows for ${client} and documented where ${terms[2]} exceptions affected downstream ${terms[3]} decisions.`
  ];
  const variants = [
    `Aligned ${client} stakeholders around ${role} priorities by converting ${profile.evidence} into practical decisions for ${profile.workflow}, helping ${metrics[0]}.`,
    `Refined the ${terms[0]} to ${terms[1]} workflow at ${client} with clearer checkpoints, ${artifacts[0]}, and validation notes, helping ${metrics[0]}.`,
    domainDecisionVariants[projectIndex % domainDecisionVariants.length],
    `Executed ${actions[0].toLowerCase()} with ${skillPhrase}${project.cloud ? ` on ${project.cloud}` : ""}, tying project evidence to release readiness and helping ${metrics[1]}.`,
    improvementVariants[projectIndex % improvementVariants.length],
    readinessVariants[projectIndex % readinessVariants.length]
  ];
  return `- ${variants[bulletIndex % variants.length]}`;
}

function maturityActionSet(level) {
  const actions = {
    early: ["Documented", "Validated", "Supported", "Mapped", "Coordinated", "Prepared"],
    mid: ["Owned", "Implemented", "Streamlined", "Resolved", "Improved", "Coordinated"],
    senior: ["Led", "Optimized", "Guided", "Improved", "Resolved", "Standardized"],
    lead: ["Led", "Established", "Prioritized", "Mentored", "Directed", "Strengthened"]
  };
  return actions[level] || actions.early;
}

function genericMetricSet(level) {
  const metrics = {
    early: ["improving validation accuracy by 18%", "reducing follow-up effort by 12 hours per month", "improving defect visibility by 22%"],
    mid: ["reducing manual effort by 20 hours per month", "improving workflow turnaround by 25%", "cutting rework by 24%"],
    senior: ["improving release readiness by 28%", "reducing delivery risk by 30%", "improving stakeholder decision speed by 32%"],
    lead: ["improving operating consistency by 35%", "raising delivery predictability by 30%", "reducing repeated escalations by 27%"]
  };
  return metrics[level] || metrics.early;
}

function jdResponsibilityThemes(resumeContext, jobKeywordGroups) {
  const roleTerms = resumeContext.targetAnalysis?.coreResponsibilities || [];
  const safeTerms = resumeContext.skillClassification?.resumeSafeTerms || [];
  return unique([
    ...roleTerms,
    ...safeTerms,
    ...(jobKeywordGroups.businessKeywords || []),
    ...(jobKeywordGroups.softSkills || []),
    ...(jobKeywordGroups.domainKeywords || [])
  ])
    .filter((term) => !skillCategory(term) || safeTerms.some((safe) => normalize(safe) === normalize(term)))
    .slice(0, 16);
}

function jdRelevantBulletSet(project, level, groupedSkills, resumeContext, jobKeywordGroups) {
  const actions = maturityActionSet(level);
  const terms = domainTerms(project.domain);
  const profile = domainProfile(project.domain);
  const themes = jdResponsibilityThemes(resumeContext, jobKeywordGroups);
  const skills = unique([
    ...flattenGroupedSkills(groupedSkills),
    ...themes.filter((term) => !skillCategory(term))
  ]);
  const artifacts = authenticRoleArtifacts(inferRoleTrack(resumeContext.targetJobTitle), resumeContext.skillClassification);
  const metrics = genericMetricSet(level);
  const index = Number(project.sequence || 0);
  const pick = (items, offset, fallback) => items.length ? items[(index + offset) % items.length] : fallback;
  const client = project.clientName;
  const domain = project.domain || "business operations";
  const responsibility = pick(themes, 0, "role-aligned delivery");
  const secondary = pick(themes, 1, "stakeholder alignment");
  const skill = pick(skills, 2, "structured analysis");
  const artifact = pick(artifacts, 3, "validation evidence");

  return [
    `- ${actions[0]} ${responsibility} needs for ${client} by using ${artifact} and ${skill} across ${profile.workflow}, ${metrics[0]}.`,
    `- ${actions[1]} ${terms[0]} and ${terms[1]} scenarios through ${secondary} checkpoints, giving ${domain} stakeholders clearer release evidence and ${metrics[1]}.`,
    `- ${actions[2]} handoffs between ${profile.stakeholders} with process notes, validation findings, and decision records so project scope stayed connected to the target ${resumeContext.targetJobTitle} expectations.`,
    `- ${actions[3]} recurring gaps in ${terms[2]} workflows by tracing root causes through ${profile.evidence}, helping teams reduce avoidable rework while keeping delivery realistic.`,
    `- ${actions[4]} project execution with ${skill}, ${artifact}, and domain-specific review routines, improving visibility into ${terms[3]} risks before release decisions were made.`,
    `- ${actions[5]} reusable documentation, open-risk notes, and outcome evidence for ${client}, helping later teams understand ${terms[4]} decisions without repeating earlier analysis.`
  ];
}

function buildJdRelevantProjectBlocks(projects, years, groupedSkills, resumeContext, jobKeywordGroups) {
  return projects.map((project, index) => {
    const level = careerLevel(Number(years), index, projects.length);
    const role = resolveProjectRole(project, Number(years), index, resumeContext.targetJobTitle);
    const bullets = jdRelevantBulletSet(project, level, groupedSkills, resumeContext, jobKeywordGroups);
    const block = {
      ...project,
      role,
      bullets
    };
    return {
      ...block,
      text: buildProjectText(block)
    };
  });
}

function optimizeDraftForAtsRelevance(draft, resumeContext, projects, groupedSkills, jobKeywordGroups, attempt = 0) {
  const initialBlocks = buildJdRelevantProjectBlocks(projects, resumeContext.years, groupedSkills, resumeContext, jobKeywordGroups);
  const duplicateRepair = rewriteDuplicateProjectBullets(initialBlocks, resumeContext, groupedSkills, attempt);
  const projectBlocks = duplicateRepair.projectBlocks;
  const optimized = rebuildDraftWithProjectBlocks(draft, resumeContext, projectBlocks);
  const rewrittenCount = initialBlocks.reduce((count, project, index) => (
    count + project.bullets.filter((bullet, bulletIndex) => bullet !== (draft.projectBlocks[index]?.bullets[bulletIndex] || "")).length
  ), 0) + duplicateRepair.rewrites;
  return {
    draft: optimized,
    removedIrrelevantContent: rewrittenCount ? ["Generic or weak project bullets replaced with JD-supported project bullets"] : [],
    rewrites: rewrittenCount
  };
}

function rewriteDuplicateProjectBullets(projectBlocks, resumeContext, groupedSkills, attempt = 0) {
  let blocks = projectBlocks.map((project) => ({
    ...project,
    bullets: [...project.bullets]
  }));
  let rewrites = 0;

  for (let pass = 0; pass < DUPLICATE_REWRITE_PASSES; pass += 1) {
    const duplicatePairs = findDuplicateBulletPairs(blocks);
    if (!duplicatePairs.length) break;
    const rewrittenThisPass = new Set();
    duplicatePairs.forEach(({ right }) => {
      const key = `${right.projectIndex}:${right.bulletIndex}`;
      if (rewrittenThisPass.has(key) || !blocks[right.projectIndex]) return;
      blocks[right.projectIndex].bullets[right.bulletIndex] = projectSpecificBullet(
        blocks[right.projectIndex],
        resumeContext,
        groupedSkills,
        right.bulletIndex,
        attempt + pass + rewrites
      );
      rewrittenThisPass.add(key);
      rewrites += 1;
    });
    blocks = blocks.map((project) => ({
      ...project,
      text: buildProjectText(project)
    }));
  }

  return {
    projectBlocks: blocks,
    duplicatePairsRemaining: findDuplicateBulletPairs(blocks).length,
    rewrites
  };
}

function rebuildDraftWithProjectBlocks(draft, data, projectBlocks) {
  const experience = projectBlocks.map((project) => project.text).join("\n\n");
  const resume = populateTemplate(data.template, {
    candidateName: data.candidateName,
    jobTitle: data.jobTitle,
    projectBlocks,
    summary: draft.summary,
    skills: draft.skills,
    experience
  });
  return {
    ...draft,
    experience,
    projectBlocks,
    resume
  };
}

function recruiterScore(projectBlocks, resume) {
  const bulletText = projectBlocks.flatMap((project) => project.bullets).join("\n");
  const projectCount = Math.max(1, projectBlocks.length);
  const metricCount = (bulletText.match(/\b\d+%|\b\d+ hours|from \d+% to \d+%|\b\d+ product KPIs|\b\d+ operating metrics/g) || []).length;
  const stakeholderCount = (bulletText.match(/stakeholder|product owner|business user|operations manager|support manager|release team|QA|HRIS/gi) || []).length;
  const domainCount = (bulletText.match(/claims|member services|patient data|supply chain|transportation|inventory|network operations|provisioning|connectivity|transaction|tenant|payroll|security/gi) || []).length;
  const genericPenalty = (resume.match(/responsible for|worked on|involved in|participated in/gi) || []).length * 5;
  const base = Math.min(100, 70 + (metricCount >= projectCount * 2 ? 15 : 5) + (stakeholderCount >= projectCount ? 7 : 0) + (domainCount >= projectCount ? 8 : 0));
  return Math.max(0, base - genericPenalty);
}

function projectQualityScore(projectBlocks, resume) {
  const projectCount = Math.max(1, projectBlocks.length);
  const completeProjects = projectBlocks.filter((project) => {
    const text = project.bullets.join("\n");
    const metrics = (text.match(/\b\d+%|\b\d+ hours|from \d+% to \d+%|\b\d+ product KPIs|\b\d+ operating metrics/g) || []).length;
    const hasStakeholder = /stakeholder|product owner|business user|operations manager|support manager|release team|QA|HRIS/i.test(text);
    const hasProcess = /process|workflow|handoff|checkpoint|root-cause|root cause|gap|validation/i.test(text);
    const hasDomain = /claims|member services|patient data|supply chain|transportation|inventory|network operations|provisioning|connectivity|transaction|tenant|payroll|security|compliance/i.test(text);
    const hasExecution = /using|applied|release|execution|UAT|BRD|FRD|API|CI\/CD|configuration|testing|reporting|dashboard/i.test(text);
    return metrics >= 2 && hasStakeholder && hasProcess && hasDomain && hasExecution;
  }).length;
  const sectionQuality = Math.round((completeProjects / projectCount) * 100);
  const structure = /Summary:|Professional Summary:/i.test(resume) && /Responsibilities:/i.test(resume) ? 100 : 90;
  return Math.round((sectionQuality * 0.85) + (structure * 0.15));
}

function unsupportedClaimKeywords(resumeContext, resume) {
  return unique(resumeContext.skillClassification?.missing || [])
    .filter((skill) => skillCategory(skill))
    .filter((skill) => contentContains(resume, skill));
}

function progressionScore(projectBlocks) {
  const roles = projectBlocks.map((project) => normalize(project.role));
  if (!roles.length) return 100;
  const latest = roles[0] || "";
  const earliest = roles[roles.length - 1] || "";
  const latestStrong = /lead|senior|principal|manager|owner/.test(latest);
  const earliestJunior = /junior|associate|analyst|developer|engineer|consultant/.test(earliest);
  return latestStrong && earliestJunior ? 100 : 90;
}

function responsibilityAlignmentScore(resumeContext, resume, projectBlocks, jobKeywordGroups) {
  const rows = requirementRows(resumeContext, projectBlocks, { "Profile Skills": resumeContext.skills || [] }, jobKeywordGroups);
  const supportedTerms = unique([
    ...safeMatchedTerms(rows, resumeContext),
    ...(resumeContext.targetAnalysis?.coreResponsibilities || []),
    ...(jobKeywordGroups.businessKeywords || []),
    ...(jobKeywordGroups.softSkills || []),
    ...(jobKeywordGroups.domainKeywords || [])
  ]);
  const coverage = scoreCoverage(supportedTerms, resume);
  const bulletText = projectBlocks.flatMap((project) => project.bullets).join("\n");
  const actionCoverage = /\b(Analyzed|Aligned|Built|Coordinated|Delivered|Documented|Established|Facilitated|Guided|Improved|Led|Mapped|Optimized|Owned|Resolved|Streamlined|Validated)\b/i.test(bulletText) ? 100 : 70;
  return Math.round((coverage * 0.75) + (actionCoverage * 0.25));
}

function irrelevantContentScore(resumeContext, resume) {
  const roleTrack = inferRoleTrack(resumeContext.targetJobTitle);
  const contamination = contaminationPenalty(roleTrack, resume, resumeContext.jobDescription, resumeContext.candidateProfileText);
  const unsupported = unsupportedClaimKeywords(resumeContext, resume).length * 12;
  const generic = (resume.match(/responsible for|worked on|involved in|participated in/gi) || []).length * 5;
  return Math.max(0, 100 - contamination - unsupported - generic);
}

function containsGenericResumePhrases(resume) {
  return /Partnered with stakeholders to align|Converted root-cause findings|Created domain-specific coverage|Strengthened collaboration|Delivery grounded in business needs|responsible for|worked on|involved in|participated in/i.test(resume);
}

function finalResumeStatus(analysis, report) {
  const blockers = blockingValidationErrors(report?.validationErrors || []);
  if (blockers.includes("duplicate_bullets") || analysis.authenticity_score < 90) {
    return "blocked_duplicate_or_generic_bullets";
  }
  if (analysis.unsupported_keywords.length) {
    return "blocked_exaggeration_risk";
  }
  if (blockers.length || analysis.relevance_score < 60) {
    return "needs_review_low_relevance";
  }
  if (analysis.missing_keywords.length && analysis.ats_score < 90) {
    return "needs_review_missing_required_skills";
  }
  if (analysis.ats_score >= 90 && analysis.relevance_score >= 80) {
    return "ready_ats_90_plus";
  }
  return "ready_best_possible";
}

function improvementSummary(previousAnalysis, nextAnalysis, rewrites = 0) {
  const notes = [];
  if (!previousAnalysis) {
    notes.push("Analyzed JD relevance after initial resume generation.");
  } else {
    if (nextAnalysis.ats_score > previousAnalysis.ats_score) notes.push(`Improved ATS score from ${previousAnalysis.ats_score}% to ${nextAnalysis.ats_score}%.`);
    if (nextAnalysis.relevance_score > previousAnalysis.relevance_score) notes.push(`Improved relevance score from ${previousAnalysis.relevance_score}% to ${nextAnalysis.relevance_score}%.`);
  }
  if (rewrites) notes.push(`Rewrote ${rewrites} project bullet${rewrites === 1 ? "" : "s"} with JD-supported context.`);
  if (nextAnalysis.unsupported_keywords.length) {
    notes.push("Flagged unsupported JD skills so they are not overstated.");
  }
  if (!notes.length) notes.push("Resume already met the relevance and authenticity checks.");
  return notes.join(" ");
}

function atsRelevanceAnalysis({ resumeContext, resume, projectBlocks, groupedSkills, jobKeywordGroups, report, previousAnalysis = null, rewrites = 0, removedIrrelevantContent = [] }) {
  const rows = requirementRows(resumeContext, projectBlocks, groupedSkills, jobKeywordGroups);
  const matched = rowsByStatus(rows, "Strong Match");
  const transferable = rowsByStatus(rows, "Partial Match");
  const missing = rowsByStatus(rows, "Missing");
  const unsupported = unsupportedClaimKeywords(resumeContext, resume);
  const atsScore = report?.atsScore ?? qualityGateScore({
    data: resumeContext,
    resume,
    projectBlocks,
    groupedSkills,
    jobKeywordGroups
  });
  const roleTrack = inferRoleTrack(resumeContext.targetJobTitle);
  const roleRelevance = scoreCoverage([
    resumeContext.targetJobTitle,
    ...roleTerminology(roleTrack, resumeContext.skillClassification),
    ...(resumeContext.targetAnalysis?.coreResponsibilities || [])
  ], resume);
  const skillAuthenticity = Math.max(0, 100 - (unsupported.length * 20));
  const responsibilityAlignment = responsibilityAlignmentScore(resumeContext, resume, projectBlocks, jobKeywordGroups);
  const chronology = progressionScore(projectBlocks);
  const readability = recruiterScore(projectBlocks, resume);
  const authenticity = duplicateScore(projectBlocks);
  const noIrrelevantContent = irrelevantContentScore(resumeContext, resume);
  const unsupportedRisk = Math.max(0, 100 - (unsupported.length * 25));
  const relevanceScore = Math.max(0, Math.min(100, Math.round(
    (roleRelevance * 0.22) +
    (skillAuthenticity * 0.2) +
    (responsibilityAlignment * 0.22) +
    (chronology * 0.12) +
    (readability * 0.14) +
    (noIrrelevantContent * 0.1)
  )));
  const analysis = {
    ats_score: atsScore,
    keyword_match_score: report?.keywordCoverage ?? atsMatchScore(rows),
    role_relevance_score: roleRelevance,
    responsibility_alignment_score: responsibilityAlignment,
    seniority_alignment_score: chronology,
    recruiter_readability_score: readability,
    authenticity_score: authenticity,
    chronological_growth_score: chronology,
    skills_authenticity_score: skillAuthenticity,
    unsupported_keyword_risk_score: unsupportedRisk,
    relevance_score: relevanceScore,
    missing_keywords: missing,
    matched_keywords: matched,
    transferable_keywords: transferable,
    unsupported_keywords: unsupported,
    removed_irrelevant_content: unique(removedIrrelevantContent),
    rewritten_sections: rewrites ? ["Project Experience"] : [],
    improvement_summary: "",
    final_resume_status: "ready_best_possible"
  };
  analysis.improvement_summary = improvementSummary(previousAnalysis, analysis, rewrites);
  analysis.final_resume_status = finalResumeStatus(analysis, report);
  return analysis;
}

function qualityGateScore({ data, resume, projectBlocks, groupedSkills, jobKeywordGroups }) {
  const roleTrack = inferRoleTrack(data.jobTitle);
  const keywordCoverage = atsMatchScore(requirementRows(data, projectBlocks, groupedSkills, jobKeywordGroups));
  const roleAlignment = scoreCoverage(roleTerminology(roleTrack, data.skillClassification), resume);
  const skillsAlignment = scoreCoverage(flattenGroupedSkills(groupedSkills), resume);
  const recruiterReadability = recruiterScore(projectBlocks, resume);
  const projectQuality = projectQualityScore(projectBlocks, resume);
  const authenticity = duplicateScore(projectBlocks);
  const careerProgression = progressionScore(projectBlocks);
  const penalty = contaminationPenalty(roleTrack, resume, data.jobDescription, data.candidateProfileText);

  return Math.max(0, Math.min(100, Math.round(
    (keywordCoverage * 0.25) +
    (roleAlignment * 0.2) +
    (skillsAlignment * 0.15) +
    (recruiterReadability * 0.15) +
    (projectQuality * 0.1) +
    (authenticity * 0.1) +
    (careerProgression * 0.05) -
    penalty
  )));
}

function qualityGateReport({ data, resume, projectBlocks, groupedSkills, jobKeywordGroups }) {
  const roleTrack = inferRoleTrack(data.jobTitle);
  const requirements = unique([
    ...jobKeywordGroups.requiredSkills,
    ...jobKeywordGroups.preferredSkills,
    ...jobKeywordGroups.businessKeywords,
    ...jobKeywordGroups.technicalKeywords,
    ...jobKeywordGroups.toolsPlatformsMethodologies,
    ...jobKeywordGroups.softSkills,
    ...jobKeywordGroups.domainKeywords
  ]);
  const keywordCoverage = atsMatchScore(requirementRows(data, projectBlocks, groupedSkills, jobKeywordGroups));
  const roleAlignment = scoreCoverage(roleTerminology(roleTrack, data.skillClassification), resume);
  const skillsAlignment = scoreCoverage(flattenGroupedSkills(groupedSkills), resume);
  const recruiter = recruiterScore(projectBlocks, resume);
  const authenticity = duplicateScore(projectBlocks);
  const projectQuality = projectQualityScore(projectBlocks, resume);
  const careerProgression = progressionScore(projectBlocks);
  const roleContamination = contaminationPenalty(roleTrack, resume, data.jobDescription, data.candidateProfileText);
  const atsScore = qualityGateScore({ data, resume, projectBlocks, groupedSkills, jobKeywordGroups });
  const validationErrors = validateGeneratedResume(data, resume, projectBlocks, {
    authenticity,
    keywordCoverage,
    roleContamination
  });

  return {
    allowedTerms: data.skillClassification?.allowedTerms || [],
    atsScore,
    authenticity,
    careerProgression,
    keywordCoverage,
    projectQuality,
    recruiter,
    requirements,
    roleAlignment,
    roleContamination,
    skillClassification: data.skillClassification || {},
    skillsAlignment,
    validationErrors
  };
}

function passesFinalGate(report) {
  return report.atsScore >= 95 &&
    report.recruiter >= 95 &&
    report.roleAlignment >= 95 &&
    report.authenticity >= 90 &&
    report.keywordCoverage >= 95 &&
    report.projectQuality >= 90 &&
    report.roleContamination <= 5 &&
    !report.validationErrors.length;
}

function blockingValidationErrors(errors = []) {
  const nonBlocking = new Set([
    "keyword_coverage_low",
    "role_contamination",
    "unsupported_skill_claim"
  ]);
  return errors.filter((error) => !nonBlocking.has(error));
}

function hasMeaningfulGeneration(report) {
  return !!report &&
    report.authenticity >= 90 &&
    blockingValidationErrors(report.validationErrors).length === 0;
}

function missingCoverageTerms(report, resume, roleTrack, jobDescription) {
  const forbidden = contaminationTerms(roleTrack).filter((term) => !normalize(jobDescription).includes(term.toLowerCase()));
  const allowedTerms = report.skillClassification?.resumeSafeTerms || report.allowedTerms || report.requirements || [];
  return unique([
    ...allowedTerms,
    ...roleTerminology(roleTrack, report.skillClassification)
  ])
    .filter((term) => !contentContains(resume, term))
    .filter((term) => !forbidden.some((blocked) => normalize(blocked) === normalize(term)))
    .slice(0, 10);
}

function extractClientLines(resume) {
  return String(resume || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Client\s*:/i.test(line))
    .map((line) => line.replace(/^Client\s*:\s*/i, "").split(/\s{2,}/)[0].trim())
    .filter(Boolean);
}

function validateGeneratedResume(resumeContext, resume, projectBlocks, reportBase = {}) {
  const errors = [];
  const placeholderPattern = /\[Insert|Candidate Name Here|Client Here|Role Here|TBD|Placeholder|\{\{[^}]*\}\}|\[\[[^\]]+\]\]/i;
  if (!contentContains(resume, resumeContext.candidateName)) {
    errors.push("candidate_name_missing");
  }
  if (placeholderPattern.test(resume)) {
    errors.push("placeholder_remaining");
  }
  const expectedClients = resumeContext.clients.map((client) => normalize(client));
  const actualClients = extractClientLines(resume).map((client) => normalize(client));
  if (expectedClients.length !== actualClients.length || expectedClients.some((client, index) => actualClients[index] !== client)) {
    errors.push("client_mismatch");
  }
  if (projectBlocks.some((project, index) => normalize(project.clientName) !== expectedClients[index])) {
    errors.push("project_client_mismatch");
  }
  if (projectBlocks.some((project, index) => project.duration !== resumeContext.durations[index])) {
    errors.push("duration_mismatch");
  }
  const expectedRoles = resumeContext.projects.map((project, index) => resolveProjectRole(project, resumeContext.yearsOfExperience, index, resumeContext.targetJobTitle));
  if (projectBlocks.some((project, index) => project.role !== expectedRoles[index])) {
    errors.push("role_progression_mismatch");
  }
  if ((reportBase.authenticity ?? duplicateScore(projectBlocks)) < 90) {
    errors.push("duplicate_bullets");
  }
  if ((reportBase.roleContamination ?? contaminationPenalty(inferRoleTrack(resumeContext.targetJobTitle), resume, resumeContext.jobDescription, resumeContext.candidateProfileText)) > 5) {
    errors.push("role_contamination");
  }
  const unsupportedClaims = unsupportedClaimKeywords(resumeContext, resume);
  if (unsupportedClaims.length) {
    errors.push("unsupported_skill_claim");
  }
  if ((reportBase.keywordCoverage ?? 0) < 95) {
    errors.push("keyword_coverage_low");
  }
  return errors;
}

function bulletSet(project, level, skills, jobMap, resumeContext) {
  const roleTrack = inferRoleTrack(resumeContext.targetJobTitle);
  const actions = authenticRoleActions(roleTrack, level, resumeContext.skillClassification);
  const terms = domainTerms(project.domain);
  const role = cleanRoleTitle(resumeContext.targetJobTitle);
  const index = project.sequence || 0;
  const topSkills = rotatedItems(skills, index, 4);
  const skillPhrase = topSkills.length ? topSkills.join(", ") : "target-role practices";
  const cloud = project.cloud || skills.find((skill) => ["AWS", "Azure", "GCP"].includes(skill));
  const focus = projectNarrativeFocus(project, index, level);
  const profile = domainProfile(project.domain);
  const artifacts = rotatedItems(authenticRoleArtifacts(roleTrack, resumeContext.skillClassification), index * 2, 4);
  const metrics = rotatedItems(metricBank(roleTrack), index * 2, 2);
  const context = {
    actions,
    artifacts,
    cloud,
    focus,
    index,
    metrics,
    profile,
    project,
    role,
    skillPhrase,
    terms
  };

  return [
    stakeholderBullet(context),
    processBullet(context),
    domainBullet(context),
    executionBullet(context),
    improvementBullet(context),
    readinessBullet(context)
  ];
}

function buildExperience(projects, years, groupedSkills, jobMap, resumeContext) {
  return buildProjectBlocks(projects, years, groupedSkills, jobMap, resumeContext)
    .map((project) => project.text)
    .join("\n\n");
}

function buildProjectBlocks(projects, years, groupedSkills, jobMap, resumeContext) {
  const allSkills = unique(Object.values(groupedSkills).flat());
  return projects.map((project, index) => {
    const level = careerLevel(Number(years), index, projects.length);
    const bullets = bulletSet(project, level, allSkills, jobMap, resumeContext).map((line) => `- ${line}`);
    const role = resolveProjectRole(project, Number(years), index, resumeContext.targetJobTitle);
    const text = buildProjectText({
      ...project,
      role,
      bullets
    });
    return {
      ...project,
      role,
      bullets,
      text
    };
  });
}

function replaceSection(template, headingPattern, content) {
  const headings = [
    "summary",
    "professional summary",
    "it skills",
    "technical skills",
    "skills",
    "work experience",
    "professional experience",
    "experience",
    "project experience",
    "education",
    "certifications"
  ];
  const match = template.match(headingPattern);
  if (!match || match.index === undefined) return template;

  const start = match.index + match[0].length;
  const rest = template.slice(start);
  const nextHeadingPattern = new RegExp(`\\n\\s*(${headings.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:?\\s*\\n`, "i");
  const next = rest.search(nextHeadingPattern);
  const end = next === -1 ? template.length : start + next + 1;
  return `${template.slice(0, start)}\n${content.trim()}\n${template.slice(end)}`;
}

function replaceCandidateName(template, candidateName) {
  let resume = String(template || "");
  if (!candidateName) return resume;
  const placeholders = [
    /\[Insert Candidate Name Here\]/gi,
    /\[Candidate Name Here\]/gi,
    /Candidate Name Here/gi,
    /\{\{\s*candidate\s*name\s*\}\}/gi,
    /\{\{\s*candidateName\s*\}\}/gi,
    /\[\[\s*candidate\s*name\s*\]\]/gi
  ];
  placeholders.forEach((pattern) => {
    resume = resume.replace(pattern, candidateName);
  });
  if (resume === template) {
    const lines = resume.split("\n");
    const firstContentIndex = lines.findIndex((line) => line.trim());
    if (firstContentIndex >= 0 && !/^(summary|professional summary|it skills|technical skills|skills|work experience|professional experience|experience|client|role|responsibilities)\s*:?$/i.test(lines[firstContentIndex].trim())) {
      lines[firstContentIndex] = candidateName;
      resume = lines.join("\n");
    }
  }
  return resume;
}

function replaceSequentialTextMarkers(text, markerPattern, replacements) {
  let index = 0;
  return String(text || "").replace(markerPattern, () => {
    const value = replacements[index] || "";
    index += 1;
    return value;
  });
}

function populateTemplate(template, sections) {
  let resume = template?.trim() || sampleTemplate;
  resume = replaceCandidateName(resume, sections.candidateName);
  resume = resume.replace(/\[Insert Job Title Here\]/gi, sections.jobTitle);
  resume = resume.replace(/\[Target Job Title Here\]/gi, sections.jobTitle);
  resume = resume.replace(/\[Insert Skill Matrix Here\]/gi, sections.skills);
  resume = replaceSequentialTextMarkers(resume, /\[Client Here\]|Client Here/gi, sections.projectBlocks.map((project) => project.clientName));
  resume = replaceSequentialTextMarkers(resume, /\[Project Duration Here\]|\[Duration Here\]|Project Duration Here|Duration Here/gi, sections.projectBlocks.map((project) => project.duration));
  resume = replaceSequentialTextMarkers(resume, /\[Role Here\]|Role Here/gi, sections.projectBlocks.map((project) => project.role));

  const bulletPlaceholder = "[Insert Bullet points Here]";
  if (resume.includes(bulletPlaceholder)) {
    resume = resume.replace(bulletPlaceholder, sections.summary);
    resume = resume.replaceAll(bulletPlaceholder, "");
  }

  resume = replaceSection(resume, /^\s*Summary\s*:\s*$/im, sections.summary);
  resume = replaceSection(resume, /^\s*Professional Summary\s*:?\s*$/im, sections.summary);
  resume = replaceSection(resume, /^\s*IT Skills\s*:\s*$/im, sections.skills);
  resume = replaceSection(resume, /^\s*Technical Skills\s*:?\s*$/im, sections.skills);
  resume = replaceSection(resume, /^\s*Work Experience\s*:\s*$/im, sections.experience);
  resume = replaceSection(resume, /^\s*Professional Experience\s*:?\s*$/im, sections.experience);
  resume = resume
    .replace(/\[Populate summary here\]/gi, sections.summary)
    .replace(/\[Populate skills here\]/gi, sections.skills)
    .replace(/\[Populate project experience here\]/gi, sections.experience);

  return resume.replace(/\n{4,}/g, "\n\n\n").trim();
}

function buildResumeDraft(data, projects, groupedSkills, jobMap, correctionTerms = []) {
  const summary = buildSummary({ ...data, projects, groupedSkills, jobMap, correctionTerms });
  const summaryLineList = summaryLines({ ...data, projects, groupedSkills, jobDescription: data.jobDescription, correctionTerms });
  const skills = buildSkillMatrix(groupedSkills, data.jobDescription);
  const skillLines = skills.split("\n").filter(Boolean);
  const projectBlocks = buildProjectBlocks(projects, data.years, groupedSkills, jobMap, data);
  const experience = projectBlocks.map((project) => project.text).join("\n\n");
  const resume = populateTemplate(data.template, {
    candidateName: data.candidateName,
    jobTitle: data.jobTitle,
    projectBlocks,
    summary,
    skills,
    experience
  });

  return {
    experience,
    projectBlocks,
    resume,
    skillLines,
    skills,
    summary,
    summaryLines: summaryLineList
  };
}

function generateResumeArtifacts(data) {
  alignProjectTimeline();
  const resumeContext = createResumeContext(data);
  const projects = resumeContext.projects;
  const jobKeywordGroups = detectJobKeywordGroups(resumeContext.jobDescription);
  const targetAnalysis = analyzeResumeTarget(resumeContext.targetJobTitle, resumeContext.jobDescription, resumeContext.yearsOfExperience);
  const skillDetection = detectSkills(resumeContext, projects, jobKeywordGroups);
  const groupedSkills = skillDetection.groupedSkills;
  const jobMap = targetAnalysis.jobMap;
  resumeContext.skills = flattenGroupedSkills(groupedSkills);
  resumeContext.candidateProfileText = skillDetection.profileText;
  resumeContext.skillClassification = skillDetection.classification;
  resumeContext.targetAnalysis = targetAnalysis;
  const roleTrack = inferRoleTrack(resumeContext.targetJobTitle);
  let correctionTerms = [];
  let draft = null;
  let report = null;
  let relevanceAnalysis = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    draft = buildResumeDraft(resumeContext, projects, groupedSkills, jobMap, correctionTerms);
    const duplicateRepair = rewriteDuplicateProjectBullets(draft.projectBlocks, resumeContext, groupedSkills, attempt);
    if (duplicateRepair.rewrites) {
      draft = rebuildDraftWithProjectBlocks(draft, resumeContext, duplicateRepair.projectBlocks);
    }
    report = qualityGateReport({
      data: resumeContext,
      resume: draft.resume,
      projectBlocks: draft.projectBlocks,
      groupedSkills,
      jobKeywordGroups
    });
    relevanceAnalysis = atsRelevanceAnalysis({
      resumeContext,
      resume: draft.resume,
      projectBlocks: draft.projectBlocks,
      groupedSkills,
      jobKeywordGroups,
      report,
      rewrites: duplicateRepair.rewrites
    });
    const shouldOptimizeRelevance = attempt < 5 && (
      attempt === 0 ||
      relevanceAnalysis.ats_score < 90 ||
      relevanceAnalysis.relevance_score < 80 ||
      relevanceAnalysis.unsupported_keywords.length ||
      report.projectQuality < 75 ||
      report.roleContamination > 5
    );
    if (shouldOptimizeRelevance) {
      const previousAnalysis = relevanceAnalysis;
      const optimized = optimizeDraftForAtsRelevance(draft, resumeContext, projects, groupedSkills, jobKeywordGroups, attempt);
      draft = optimized.draft;
      report = qualityGateReport({
        data: resumeContext,
        resume: draft.resume,
        projectBlocks: draft.projectBlocks,
        groupedSkills,
        jobKeywordGroups
      });
      relevanceAnalysis = atsRelevanceAnalysis({
        resumeContext,
        resume: draft.resume,
        projectBlocks: draft.projectBlocks,
        groupedSkills,
        jobKeywordGroups,
        report,
        previousAnalysis,
        removedIrrelevantContent: optimized.removedIrrelevantContent,
        rewrites: optimized.rewrites
      });
    }
    if (passesFinalGate(report)) break;
    const nextTerms = missingCoverageTerms(report, draft.resume, roleTrack, resumeContext.jobDescription);
    const merged = unique([...correctionTerms, ...nextTerms]);
    const canKeepRefiningDuplicates = report.validationErrors.includes("duplicate_bullets") && attempt < 5;
    if (merged.length === correctionTerms.length && !canKeepRefiningDuplicates) break;
    correctionTerms = merged;
  }

  const hadGenericPhrasesBeforeFinalOptimization = draft ? containsGenericResumePhrases(draft.resume) : false;
  if (draft && (hadGenericPhrasesBeforeFinalOptimization || (relevanceAnalysis?.relevance_score || 0) < 90)) {
    const previousAnalysis = relevanceAnalysis;
    const optimized = optimizeDraftForAtsRelevance(draft, resumeContext, projects, groupedSkills, jobKeywordGroups, 6);
    draft = optimized.draft;
    report = qualityGateReport({
      data: resumeContext,
      resume: draft.resume,
      projectBlocks: draft.projectBlocks,
      groupedSkills,
      jobKeywordGroups
    });
    relevanceAnalysis = atsRelevanceAnalysis({
      resumeContext,
      resume: draft.resume,
      projectBlocks: draft.projectBlocks,
      groupedSkills,
      jobKeywordGroups,
      report,
      previousAnalysis,
      removedIrrelevantContent: [
        ...optimized.removedIrrelevantContent,
        ...(hadGenericPhrasesBeforeFinalOptimization ? ["Generic resume phrases removed"] : [])
      ],
      rewrites: optimized.rewrites
    });
  }

  const matchRows = requirementRows(resumeContext, projects, groupedSkills, jobKeywordGroups);
  const score = relevanceAnalysis?.ats_score || report?.atsScore || 0;
  const missing = rowsByStatus(matchRows, "Missing");
  const finalOutput = `ATS SCORE: ${score}%\n\n${draft.resume}`;
  const finalStatus = relevanceAnalysis?.final_resume_status || "ready_best_possible";
  const validationPassed = hasMeaningfulGeneration(report) &&
    !/^blocked_/.test(finalStatus);

  return {
    ats_score: score,
    keyword_match_score: relevanceAnalysis?.keyword_match_score || report?.keywordCoverage || 0,
    role_relevance_score: relevanceAnalysis?.role_relevance_score || report?.roleAlignment || 0,
    recruiter_readability_score: relevanceAnalysis?.recruiter_readability_score || report?.recruiter || 0,
    authenticity_score: relevanceAnalysis?.authenticity_score || report?.authenticity || 0,
    chronological_growth_score: relevanceAnalysis?.chronological_growth_score || report?.careerProgression || 0,
    relevance_score: relevanceAnalysis?.relevance_score || 0,
    missing_keywords: relevanceAnalysis?.missing_keywords || missing,
    matched_keywords: relevanceAnalysis?.matched_keywords || rowsByStatus(matchRows, "Strong Match"),
    transferable_keywords: relevanceAnalysis?.transferable_keywords || rowsByStatus(matchRows, "Partial Match"),
    unsupported_keywords: relevanceAnalysis?.unsupported_keywords || [],
    removed_irrelevant_content: relevanceAnalysis?.removed_irrelevant_content || [],
    rewritten_sections: relevanceAnalysis?.rewritten_sections || [],
    improvement_summary: relevanceAnalysis?.improvement_summary || "",
    final_resume_status: finalStatus,
    jobTitle: resumeContext.targetJobTitle,
    candidateName: resumeContext.candidateName,
    resumeContext,
    atsMatchScore: score,
    keywordMatchScore: relevanceAnalysis?.keyword_match_score || report?.keywordCoverage || 0,
    roleRelevanceScore: relevanceAnalysis?.role_relevance_score || report?.roleAlignment || 0,
    recruiterReadabilityScore: relevanceAnalysis?.recruiter_readability_score || report?.recruiter || 0,
    authenticityScore: relevanceAnalysis?.authenticity_score || report?.authenticity || 0,
    chronologicalGrowthScore: relevanceAnalysis?.chronological_growth_score || report?.careerProgression || 0,
    relevanceScore: relevanceAnalysis?.relevance_score || 0,
    jobKeywordGroups,
    matchRows,
    missingSkills: missing,
    matchedKeywords: relevanceAnalysis?.matched_keywords || rowsByStatus(matchRows, "Strong Match"),
    transferableKeywords: relevanceAnalysis?.transferable_keywords || rowsByStatus(matchRows, "Partial Match"),
    unsupportedKeywords: relevanceAnalysis?.unsupported_keywords || [],
    removedIrrelevantContent: relevanceAnalysis?.removed_irrelevant_content || [],
    rewrittenSections: relevanceAnalysis?.rewritten_sections || [],
    improvementSummary: relevanceAnalysis?.improvement_summary || "",
    finalResumeStatus: finalStatus,
    atsRelevanceAnalysis: relevanceAnalysis,
    qualityReport: report,
    validationPassed,
    summary: draft.summary,
    summaryLines: draft.summaryLines,
    skills: draft.skills,
    skillLines: draft.skillLines,
    experience: draft.experience,
    projectBlocks: draft.projectBlocks,
    finalResume: draft.resume,
    resume: finalOutput
  };
}

function generateResume(data) {
  return generateResumeArtifacts(data).resume;
}

function formData() {
  return Object.fromEntries(new FormData(form).entries());
}

function sanitizeFilePart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/\[[^\]]+\]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]+/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

function downloadFileName(artifacts, extension) {
  const name = sanitizeFilePart(form.elements.candidateName.value, "Candidate");
  const jobTitle = sanitizeFilePart(artifacts.jobTitle || form.elements.jobTitle.value, "Resume");
  return `${name}_${jobTitle}.${extension}`;
}

function syncActions() {
  const canUseResume = resumeReady && !!latestResumeArtifacts && !!outputEl.textContent.trim();
  copyBtn.disabled = !canUseResume;
  downloadBtn.disabled = !canUseResume || !uploadedDocxTemplate;
  copyBtn.title = canUseResume ? "Copy resume" : "Generate resume first";
  downloadBtn.title = canUseResume
    ? uploadedDocxTemplate ? "Download resume" : "Select an uploaded .docx template to download"
    : "Generate resume first";
}

function setStatus(message = "", state = "neutral") {
  statusText.textContent = message;
  statusText.dataset.state = state;
  syncActions();
}

function invalidateGeneratedResume(message = "No resume generated yet.") {
  latestResumeArtifacts = null;
  resumeReady = false;
  outputEl.textContent = "";
  setStatus(message, message ? "neutral" : "neutral");
}

function activeTemplate() {
  return storedTemplates.find((template) => template.id === activeTemplateId) || null;
}

function updateUploadedValidation(templates = storedTemplates) {
  if (!templateUploadValidation) return;
  templateUploadValidation.textContent = templates.length
    ? `Uploaded: ${templates.map((template) => template.name).join(", ")}`
    : "";
}

function setActiveTemplate(templateId, options = {}) {
  const selected = storedTemplates.find((template) => template.id === templateId);
  if (!selected) return;
  activeTemplateId = selected.id;
  templateArea.value = selected.text;
  uploadedDocxTemplate = selected.docxBuffer ? {
    name: selected.name,
    buffer: selected.docxBuffer
  } : null;
  invalidateGeneratedResume("");
  setStatus("Template uploaded.", "success");
  if (!options.silentValidation) {
    updateUploadedValidation();
  }
  renderTemplateList();
}

function renderTemplateList() {
  if (!templateListEl) return;
  templateListEl.innerHTML = "";
  storedTemplates.forEach((template) => {
    const label = document.createElement("label");
    label.className = "template-item";
    if (template.id === activeTemplateId) label.classList.add("is-active");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "activeTemplate";
    input.value = template.id;
    input.checked = template.id === activeTemplateId;
    input.addEventListener("change", () => setActiveTemplate(template.id));

    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = template.name;
    const status = document.createElement("span");
    status.textContent = template.id === activeTemplateId ? "Active Template" : "Uploaded - select to use";
    details.append(name, status);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-template";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeTemplate(template.id);
    });

    label.append(input, details, removeButton);
    templateListEl.appendChild(label);
  });
}

function removeTemplate(templateId) {
  const removedActive = templateId === activeTemplateId;
  storedTemplates = storedTemplates.filter((template) => template.id !== templateId);
  if (removedActive) {
    uploadedDocxTemplate = null;
    activeTemplateId = null;
    if (storedTemplates.length) {
      updateUploadedValidation();
      setActiveTemplate(storedTemplates[0].id, { silentValidation: true });
    } else {
      templateArea.value = "";
      updateUploadedValidation();
      invalidateGeneratedResume("No resume generated yet.");
    }
  } else {
    updateUploadedValidation();
    renderTemplateList();
  }
}

function validateResumeInputs(data) {
  const missing = [];
  if (!String(data.candidateName || "").trim()) missing.push("candidate name");
  if (!String(data.jobTitle || "").trim()) missing.push("target job title");
  if (!String(data.years || "").trim()) missing.push("years of experience");
  if (!String(data.jobDescription || "").trim()) missing.push("target job description");
  if (!String(data.template || "").trim()) missing.push("resume template");
  const projects = collectProjects();
  if (!projects.length) missing.push("at least one project");
  if (projects.some((project) => !project.clientName)) missing.push("client names");
  if (projects.some((project) => !project.domain)) missing.push("project domains");
  if (missing.length) {
    return `Required: ${missing.join(", ")}.`;
  }
  const years = Number(data.years);
  if (!Number.isFinite(years) || years < 0 || years > 35) {
    return "Years of experience must be a number between 0 and 35.";
  }
  return "";
}

function markDraftChanged() {
  if (resumeReady || latestResumeArtifacts) {
    invalidateGeneratedResume("Changes pending. Generate resume again.");
  }
}

function seed() {
  uploadedDocxTemplate = null;
  latestResumeArtifacts = null;
  resumeReady = false;
  storedTemplates = [];
  activeTemplateId = null;
  form.elements.candidateName.value = "";
  templateArea.value = "";
  form.elements.jobTitle.value = "";
  form.elements.years.value = "";
  form.elements.jobDescription.value = "";
  projectsEl.innerHTML = "";
  defaultProjects.forEach((project) => addProject(project));
  alignProjectTimeline();
  outputEl.textContent = "";
  if (templateUploadValidation) templateUploadValidation.textContent = "";
  setStatus("", "neutral");
  renderTemplateList();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData();
  const validationMessage = validateResumeInputs(data);
  if (validationMessage) {
    resumeReady = false;
    latestResumeArtifacts = null;
    outputEl.textContent = "";
    setStatus(validationMessage, "error");
    return;
  }
  setStatus("Improving resume quality...", "neutral");
  latestResumeArtifacts = generateResumeArtifacts(data);
  if (!latestResumeArtifacts.validationPassed) {
    resumeReady = false;
    outputEl.textContent = "";
    setStatus(FINAL_GENERATION_FAILURE_MESSAGE, "error");
    return;
  }
  resumeReady = true;
  outputEl.textContent = latestResumeArtifacts.resume;
  setStatus("Resume ready to download/copy.", "success");
});

document.querySelector("#addProjectBtn").addEventListener("click", () => {
  addProject();
  markDraftChanged();
});
document.querySelector("#useSampleBtn").addEventListener("click", () => {
  uploadedDocxTemplate = null;
  activeTemplateId = null;
  templateArea.value = sampleTemplate;
  if (templateUploadValidation) templateUploadValidation.textContent = "Sample template loaded";
  invalidateGeneratedResume("No resume generated yet.");
  renderTemplateList();
});
document.querySelector("#resetBtn")?.addEventListener("click", seed);
yearsInput.addEventListener("input", () => {
  alignProjectTimeline();
  markDraftChanged();
});
form.elements.jobTitle.addEventListener("input", () => {
  alignProjectTimeline();
  markDraftChanged();
});
form.elements.jobDescription.addEventListener("input", markDraftChanged);
templateArea.addEventListener("input", markDraftChanged);
projectsEl.addEventListener("input", markDraftChanged);

document.querySelector("#templateFile").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  try {
    const addedTemplates = [];
    for (const file of files) {
      const text = await extractFileText(file);
      if (!text.trim()) throw new Error(`No readable text was found in ${file.name}.`);
      const docxBuffer = file.name.toLowerCase().endsWith(".docx") ? await file.arrayBuffer() : null;
      const template = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        text,
        docxBuffer
      };
      addedTemplates.push(template);
    }
    storedTemplates = [...storedTemplates, ...addedTemplates];
    setActiveTemplate(addedTemplates[0].id);
    updateUploadedValidation();
    setStatus("Template uploaded.", "success");
    event.target.value = "";
  } catch (error) {
    setStatus("Template upload could not be completed. Please use a readable resume template file.", "error");
  }
});

document.querySelector("#copyBtn").addEventListener("click", async () => {
  if (copyBtn.disabled || !outputEl.textContent.trim()) return;
  await navigator.clipboard.writeText(outputEl.textContent);
  setStatus("Resume copied.", "success");
});

document.querySelector("#downloadBtn").addEventListener("click", async () => {
  if (!resumeReady || !latestResumeArtifacts || !outputEl.textContent.trim()) {
    setStatus("Generate the resume before downloading.", "error");
    return;
  }
  const artifacts = latestResumeArtifacts;

  if (!uploadedDocxTemplate) {
    setStatus("Select an uploaded .docx resume template before downloading.", "error");
    return;
  }

  try {
    const docxBlob = await buildDocxFromUploadedTemplate(artifacts);
    downloadBlob(docxBlob, downloadFileName(artifacts, "docx"));
    setStatus("Resume downloaded.", "success");
  } catch (error) {
    setStatus("Download could not be completed. Please select a valid .docx resume template.", "error");
  }
});

function updateStatusTone() {
  const value = statusText.textContent.toLowerCase();
  if (/error|could not|no readable|failed|upload your|required|needs more specific|before downloading|select an uploaded/.test(value)) {
    statusText.dataset.state = "error";
  } else if (/downloaded|generated|loaded|copied|uploaded|resume ready/.test(value)) {
    statusText.dataset.state = "success";
  } else {
    statusText.dataset.state = "neutral";
  }
}

new MutationObserver(updateStatusTone).observe(statusText, {
  childList: true,
  characterData: true,
  subtree: true
});

seed();
updateStatusTone();
