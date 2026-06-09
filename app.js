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

function normalize(text) {
  return String(text || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
  xml = replaceTextAnywhere(xml, "[Insert Job Title Here]", artifacts.jobTitle);
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

function detectSkills(jobDescription, template, projects) {
  const haystack = normalize([
    jobDescription,
    ...projects.flatMap((project) => [project.domain, project.cloud])
  ].join(" "));
  const grouped = {};

  for (const [category, skills] of Object.entries(skillBank)) {
    grouped[category] = unique(skills.filter((skill) => haystack.includes(skill.toLowerCase())));
  }

  const addSkills = (category, skills) => {
    grouped[category] = unique([...(grouped[category] || []), ...skills]);
  };

  if (/cloud|aws|azure|gcp/.test(haystack) || projects.some((project) => project.cloud)) {
    addSkills("Cloud Platforms", unique(projects.map((project) => project.cloud)).filter(Boolean));
  }

  return Object.fromEntries(Object.entries(grouped).filter(([, skills]) => skills.length));
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

function suggestedDesignation(years, index) {
  const roleFamily = cleanRoleTitle(form.elements.jobTitle.value);
  if (index === 0 && years >= 8) return `Lead ${roleFamily}`;
  if (index <= 1 && years >= 5) return `Senior ${roleFamily}`;
  if (index <= 2 && years >= 2) return roleFamily;
  return `Junior ${roleFamily}`;
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
    if (!designationInput.value || /associate|software engineer|sitecore developer|senior|lead|developer/i.test(designationInput.value)) {
      designationInput.value = suggestedDesignation(years, index);
    }
    end = addMonths(start, -1);
  });
}

function buildSummary({ jobTitle, years, projects, groupedSkills, jobDescription, correctionTerms = [] }) {
  const domains = unique(projects.map((project) => project.domain)).slice(0, 3).join(", ");
  const skills = flattenGroupedSkills(groupedSkills).slice(0, 12);
  const role = cleanRoleTitle(jobTitle);
  const roleTrack = inferRoleTrack(role);
  const value = roleValuePhrase(roleTrack);
  const artifacts = roleArtifacts(roleTrack);
  const keywordBridge = unique([summaryKeywordBridge(jobDescription), ...correctionTerms].flatMap((item) => String(item || "").split(",").map((part) => part.trim()))).filter(Boolean).slice(0, 12).join(", ");

  return [
    `- ${role} with ${years}+ years of experience delivering ${value} across ${domains || "business-critical domains"}.`,
    `- Applies ${skills.slice(0, 8).join(", ") || "role-aligned practices"} to translate target-role requirements into practical outcomes, clear deliverables, and measurable execution discipline.`,
    `- Uses ${artifacts.slice(0, 5).join(", ")}${artifacts.length > 5 ? `, and ${artifacts.slice(5).join(", ")}` : ""} to keep the resume aligned to the ${role} ecosystem rather than unrelated role content.`,
    `- Strengthens ${keywordBridge || "business alignment, communication, collaboration, and release readiness"} through stakeholder collaboration, structured analysis, delivery ownership, quality validation, and continuous improvement.`
  ].join("\n");
}

function summaryLines({ jobTitle, years, projects, groupedSkills, jobDescription, correctionTerms = [] }) {
  return buildSummary({ jobTitle, years, projects, groupedSkills, jobDescription, correctionTerms }).split("\n");
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

function classifyRequirement(keyword, candidateText, candidateSkills) {
  const normalized = normalize(keyword);
  if (!normalized) return "Missing";
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
    status: classifyRequirement(keyword, candidateText, candidateSkills)
  }));
}

function atsMatchScore(rows) {
  if (!rows.length) return 0;
  const score = rows.reduce((sum, row) => {
    if (row.status === "Strong Match") return sum + 1;
    if (row.status === "Partial Match") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((score / rows.length) * 100);
}

function rowsByStatus(rows, status) {
  return rows.filter((row) => row.status === status).map((row) => row.keyword);
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

function roleTerminology(roleTrack) {
  return roleArtifacts(roleTrack);
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

function contaminationPenalty(roleTrack, resume, jobDescription) {
  const jd = normalize(jobDescription);
  return contaminationTerms(roleTrack)
    .filter((term) => contentContains(resume, term) && !jd.includes(term.toLowerCase()))
    .length * 8;
}

function bulletSimilarity(left, right) {
  const tokens = (text) => unique(normalize(text).match(/[a-z0-9]+/g) || [])
    .filter((token) => token.length > 3 && !["with", "from", "that", "into", "using", "project"].includes(token));
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
  if (maxSimilarity <= 0.3) return 100;
  return Math.max(70, Math.round(100 - ((maxSimilarity - 0.3) * 100)));
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

function progressionScore(projectBlocks) {
  const roles = projectBlocks.map((project) => normalize(project.role));
  if (!roles.length) return 100;
  const latest = roles[0] || "";
  const earliest = roles[roles.length - 1] || "";
  const latestStrong = /lead|senior|principal|manager|owner/.test(latest);
  const earliestJunior = /junior|associate|analyst|developer|engineer|consultant/.test(earliest);
  return latestStrong && earliestJunior ? 100 : 90;
}

function qualityGateScore({ data, resume, projectBlocks, groupedSkills, jobKeywordGroups }) {
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
  const keywordCoverage = scoreCoverage(requirements, resume);
  const roleAlignment = scoreCoverage(roleTerminology(roleTrack), resume);
  const skillsAlignment = scoreCoverage(flattenGroupedSkills(groupedSkills), resume);
  const recruiterReadability = recruiterScore(projectBlocks, resume);
  const projectQuality = projectQualityScore(projectBlocks, resume);
  const authenticity = duplicateScore(projectBlocks);
  const careerProgression = progressionScore(projectBlocks);
  const penalty = contaminationPenalty(roleTrack, resume, data.jobDescription);

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
  const keywordCoverage = scoreCoverage(requirements, resume);
  const roleAlignment = scoreCoverage(roleTerminology(roleTrack), resume);
  const skillsAlignment = scoreCoverage(flattenGroupedSkills(groupedSkills), resume);
  const recruiter = recruiterScore(projectBlocks, resume);
  const authenticity = duplicateScore(projectBlocks);
  const projectQuality = projectQualityScore(projectBlocks, resume);
  const careerProgression = progressionScore(projectBlocks);
  const roleContamination = contaminationPenalty(roleTrack, resume, data.jobDescription);
  const atsScore = qualityGateScore({ data, resume, projectBlocks, groupedSkills, jobKeywordGroups });

  return {
    atsScore,
    authenticity,
    careerProgression,
    keywordCoverage,
    projectQuality,
    recruiter,
    requirements,
    roleAlignment,
    roleContamination,
    skillsAlignment
  };
}

function passesFinalGate(report) {
  return report.atsScore >= 95 &&
    report.recruiter >= 95 &&
    report.roleAlignment >= 95 &&
    report.authenticity >= 90 &&
    report.keywordCoverage >= 95 &&
    report.projectQuality >= 90 &&
    report.roleContamination <= 5;
}

function missingCoverageTerms(report, resume, roleTrack, jobDescription) {
  const forbidden = contaminationTerms(roleTrack).filter((term) => !normalize(jobDescription).includes(term.toLowerCase()));
  return unique([
    ...report.requirements,
    ...roleTerminology(roleTrack)
  ])
    .filter((term) => !contentContains(resume, term))
    .filter((term) => !forbidden.some((blocked) => normalize(blocked) === normalize(term)))
    .slice(0, 10);
}

function bulletSet(project, level, skills, jobMap) {
  const roleTrack = inferRoleTrack(form.elements.jobTitle.value);
  const actions = roleActions(roleTrack, level);
  const terms = domainTerms(project.domain);
  const role = cleanRoleTitle(form.elements.jobTitle.value);
  const index = project.sequence || 0;
  const topSkills = rotatedItems(skills, index, 4);
  const skillPhrase = topSkills.length ? topSkills.join(", ") : "target-role practices";
  const cloud = project.cloud || skills.find((skill) => ["AWS", "Azure", "GCP"].includes(skill));
  const focus = projectNarrativeFocus(project, index, level);
  const profile = domainProfile(project.domain);
  const artifacts = rotatedItems(roleArtifacts(roleTrack), index * 2, 4);
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

function buildExperience(projects, years, groupedSkills, jobMap) {
  return buildProjectBlocks(projects, years, groupedSkills, jobMap)
    .map((project) => project.text)
    .join("\n\n");
}

function buildProjectBlocks(projects, years, groupedSkills, jobMap) {
  const allSkills = unique(Object.values(groupedSkills).flat());
  return projects.map((project, index) => {
    const level = careerLevel(Number(years), index, projects.length);
    const bullets = bulletSet(project, level, allSkills, jobMap).map((line) => `- ${line}`);
    const role = suggestedDesignation(Number(years), index);
    const text = `Client: ${project.clientName}                             ${project.duration}
Role: ${role}
Responsibilities:
${bullets.join("\n")}`;
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

function populateTemplate(template, sections) {
  let resume = template?.trim() || sampleTemplate;
  resume = resume.replace(/\[Insert Job Title Here\]/gi, sections.jobTitle);
  resume = resume.replace(/\[Insert Skill Matrix Here\]/gi, sections.skills);

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
  const projectBlocks = buildProjectBlocks(projects, data.years, groupedSkills, jobMap);
  const experience = projectBlocks.map((project) => project.text).join("\n\n");
  const resume = populateTemplate(data.template, {
    jobTitle: data.jobTitle,
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
  const projects = collectProjects();
  const jobMap = analyzeJob(data.jobDescription);
  const groupedSkills = detectSkills(data.jobDescription, data.template, projects);
  const jobKeywordGroups = detectJobKeywordGroups(data.jobDescription);
  const roleTrack = inferRoleTrack(data.jobTitle);
  let correctionTerms = [];
  let draft = null;
  let report = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    draft = buildResumeDraft(data, projects, groupedSkills, jobMap, correctionTerms);
    report = qualityGateReport({
      data,
      resume: draft.resume,
      projectBlocks: draft.projectBlocks,
      groupedSkills,
      jobKeywordGroups
    });
    if (passesFinalGate(report)) break;
    const nextTerms = missingCoverageTerms(report, draft.resume, roleTrack, data.jobDescription);
    const merged = unique([...correctionTerms, ...nextTerms]);
    if (merged.length === correctionTerms.length) break;
    correctionTerms = merged;
  }

  const matchRows = requirementRows(data, projects, groupedSkills, jobKeywordGroups);
  const score = report?.atsScore || 0;
  const missing = rowsByStatus(matchRows, "Missing");
  const finalOutput = `ATS SCORE: ${score}%\n\n${draft.resume}`;

  return {
    jobTitle: data.jobTitle,
    atsMatchScore: score,
    jobKeywordGroups,
    matchRows,
    missingSkills: missing,
    qualityReport: report,
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
  setStatus("template_uploaded", "success");
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
  if (!String(data.jobTitle || "").trim()) missing.push("target job title");
  if (!String(data.years || "").trim()) missing.push("years of experience");
  if (!String(data.jobDescription || "").trim()) missing.push("target job description");
  if (!String(data.template || "").trim()) missing.push("resume template");
  if (!collectProjects().length) missing.push("at least one project");
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
  latestResumeArtifacts = generateResumeArtifacts(data);
  resumeReady = true;
  outputEl.textContent = latestResumeArtifacts.resume;
  setStatus("resume_ready", "success");
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
form.elements.jobTitle.addEventListener("input", markDraftChanged);
form.elements.jobDescription.addEventListener("input", markDraftChanged);
templateArea.addEventListener("input", markDraftChanged);
projectsEl.addEventListener("input", markDraftChanged);

document.querySelector("#jobDescriptionFile").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await extractFileText(file);
    if (!text.trim()) throw new Error("No readable text was found in this file.");
    form.elements.jobDescription.value = text;
    latestResumeArtifacts = null;
    resumeReady = false;
    outputEl.textContent = "";
    setStatus(activeTemplateId ? "template_uploaded" : "", activeTemplateId ? "success" : "neutral");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

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
    setStatus("template_uploaded", "success");
    event.target.value = "";
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.querySelector("#copyBtn").addEventListener("click", async () => {
  if (copyBtn.disabled || !outputEl.textContent.trim()) return;
  await navigator.clipboard.writeText(outputEl.textContent);
  setStatus("resume_ready", "success");
});

document.querySelector("#downloadBtn").addEventListener("click", async () => {
  if (!resumeReady || !latestResumeArtifacts || !outputEl.textContent.trim()) {
    setStatus("resume_required: click Generate resume first", "error");
    return;
  }
  const artifacts = latestResumeArtifacts;

  if (!uploadedDocxTemplate) {
    setStatus("template_required: select an uploaded .docx resume template first", "error");
    return;
  }

  try {
    const docxBlob = await buildDocxFromUploadedTemplate(artifacts);
    downloadBlob(docxBlob, downloadFileName(artifacts, "docx"));
    setStatus("resume_ready", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

function updateStatusTone() {
  const value = statusText.textContent.toLowerCase();
  if (/error|could not|no readable|failed|upload your|template_required|resume_required|required/.test(value)) {
    statusText.dataset.state = "error";
  } else if (/downloaded|generated|loaded|copied|uploaded|resume_ready|resume_copied|resume_downloaded/.test(value)) {
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
