const form = document.querySelector("#resumeForm");
const projectsEl = document.querySelector("#projects");
const projectTemplate = document.querySelector("#projectTemplate");
const outputEl = document.querySelector("#resumeOutput");
const statusText = document.querySelector("#statusText");
const templateArea = form.elements.template;
const yearsInput = form.elements.years;
let uploadedDocxTemplate = null;
let latestResumeArtifacts = null;
let generatedParagraphId = 0x10000000;

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
  "Programming Languages": ["C#", "Java", "JavaScript", "TypeScript", "Python", "SQL"],
  "Frameworks and CMS": ["Sitecore XP", "Sitecore XM", "Sitecore", "SXA", "Helix", ".NET", "ASP.NET MVC", "ASP.NET Core", "MVC", "Spring Boot", "Spring MVC", "React", "Angular", "Node.js", "Hibernate", "JPA"],
  "Cloud Platforms": ["AWS", "Azure", "GCP"],
  "Databases": ["PostgreSQL", "MySQL", "Oracle", "MongoDB", "DynamoDB", "SQL Server"],
  "CMS Authoring and Presentation": ["Content Editor", "Experience Editor", "Sitecore Workflows", "Templates", "Renderings", "Layouts", "Placeholder Settings", "Content Items", "Media Library"],
  "Search and Indexing": ["Solr", "Coveo", "Sitecore Search"],
  "Integration Technologies": ["REST APIs", "GraphQL", "SOAP", "JSON", "XML"],
  "Messaging Technologies": ["Kafka", "RabbitMQ", "SQS", "SNS", "ActiveMQ"],
  "DevOps Tools": ["Docker", "Kubernetes", "Terraform", "Maven", "Gradle", "PowerShell"],
  "CI/CD Tools": ["Jenkins", "GitHub Actions", "GitLab CI", "Azure DevOps"],
  "Testing Tools": ["xUnit", "NUnit", "MSTest", "JUnit", "Mockito", "Jest", "Cypress", "Selenium"],
  "Monitoring Tools": ["Application Insights", "CloudWatch", "Splunk", "Grafana", "Prometheus", "ELK"],
  "Version Control": ["Git", "Bitbucket", "GitHub", "GitLab"],
  "Methodologies": ["Agile", "Scrum", "Kanban", "SDLC"],
  "Architecture Patterns": ["Microservices", "Event Driven", "REST", "SOA", "Monolithic"],
  "Security Technologies": ["OAuth2", "JWT", "Spring Security", "IAM"]
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
    template,
    ...projects.flatMap((project) => [project.cloud, project.domain])
  ].join(" "));
  const grouped = {};

  for (const [category, skills] of Object.entries(skillBank)) {
    grouped[category] = unique(skills.filter((skill) => haystack.includes(skill.toLowerCase())));
  }

  const addSkills = (category, skills) => {
    grouped[category] = unique([...(grouped[category] || []), ...skills]);
  };

  if (/sitecore|sxa|helix|cms|content|experience platform/.test(haystack)) {
    addSkills("Programming Languages", ["C#", "SQL"]);
    addSkills("Frameworks and CMS", ["Sitecore XP", "Sitecore XM", "Sitecore", "SXA", "Helix", ".NET", "ASP.NET MVC"]);
    addSkills("Databases", ["SQL Server"]);
    addSkills("CMS Authoring and Presentation", ["Content Editor", "Experience Editor", "Sitecore Workflows", "Templates", "Renderings", "Layouts", "Placeholder Settings", "Content Items", "Media Library"]);
    addSkills("Search and Indexing", ["Solr"]);
    addSkills("Integration Technologies", ["REST APIs", "JSON", "XML"]);
    addSkills("DevOps Tools", ["PowerShell"]);
    addSkills("Testing Tools", ["xUnit", "NUnit", "Selenium"]);
    addSkills("Monitoring Tools", ["Application Insights"]);
    addSkills("Version Control", ["Git"]);
    addSkills("Methodologies", ["Agile", "Scrum", "SDLC"]);
    addSkills("Architecture Patterns", ["Helix", "REST"]);
  }

  if (/ci\/cd|pipeline|deployment|release|devops/.test(haystack)) {
    addSkills("CI/CD Tools", ["Azure DevOps", "Jenkins", "GitHub Actions"]);
  }

  if (/cloud|aws|azure|gcp/.test(haystack) || projects.some((project) => project.cloud)) {
    addSkills("Cloud Platforms", unique(projects.map((project) => project.cloud)).filter(Boolean));
  }

  const implied = {
    Sitecore: ["C#", ".NET", "ASP.NET MVC", "Solr"],
    "Sitecore XP": ["Sitecore", "C#", ".NET"],
    "Sitecore XM": ["Sitecore", "C#", ".NET"],
    SXA: ["Sitecore", "C#", ".NET"],
    Helix: ["Sitecore", "C#", ".NET"],
    ".NET": ["C#"],
    Java: ["Spring Boot", "JUnit", "Mockito", "Maven"],
    "Spring Boot": ["REST", "JPA"],
    React: ["JavaScript"],
    TypeScript: ["JavaScript"],
    AWS: ["CloudWatch", "IAM"],
    Microservices: ["REST", "Docker"]
  };

  Object.values(grouped).flat().forEach((skill) => {
    (implied[skill] || []).forEach((item) => {
      const category = Object.keys(skillBank).find((key) => skillBank[key].includes(item));
      if (category) grouped[category] = unique([...(grouped[category] || []), item]);
    });
  });

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
  const target = normalize(form.elements.jobTitle.value);
  const roleFamily = target.includes("sitecore") ? "Sitecore Developer" : "Software Engineer";
  if (index === 0 && years >= 8) return `Lead ${roleFamily}`;
  if (index === 0 && years >= 5) return `Senior ${roleFamily}`;
  if (index <= 1 && years >= 3) return roleFamily;
  return `Associate ${roleFamily}`;
}

function formatMonth(date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function distributeMonths(totalMonths, count) {
  if (count <= 0) return [];
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
  const years = Math.max(0, Number(yearsInput.value || 0));
  const cards = [...projectsEl.querySelectorAll(".project-card")];
  if (!cards.length) return;
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

function buildSummary({ jobTitle, years, projects, groupedSkills, jobMap }) {
  const domains = unique(projects.map((project) => project.domain)).slice(0, 3).join(", ");
  const skills = unique(Object.values(groupedSkills).flat()).slice(0, 12);
  const cloud = groupedSkills["Cloud Platforms"]?.join(", ");
  const architecture = groupedSkills["Architecture Patterns"]?.filter((item) => item !== "REST").join(", ");
  const leadership = Number(years) >= 7 || jobMap.leadership
    ? " Experienced in technical leadership, code reviews, mentoring, cross-team collaboration, and production support ownership."
    : " Experienced in feature delivery, code quality, testing, documentation, and production support collaboration.";

  return [
    `- ${jobTitle} with ${years}+ years of experience designing, developing, testing, and supporting enterprise applications across ${domains || "business-critical domains"}.`,
    `- Skilled in ${skills.join(", ") || "modern software engineering practices"} with exposure to ${architecture || "application architecture"}${cloud ? ` and ${cloud} cloud environments` : ""}.`,
    `- Adept at translating business requirements into maintainable solutions across the SDLC while partnering with product, QA, DevOps, and architecture teams.${leadership}`
  ].join("\n");
}

function summaryLines({ jobTitle, years, projects, groupedSkills, jobMap }) {
  return buildSummary({ jobTitle, years, projects, groupedSkills, jobMap }).split("\n");
}

function buildSkillMatrix(groupedSkills) {
  return Object.entries(groupedSkills)
    .map(([category, skills]) => `${category}: ${skills.join(", ")}`)
    .join("\n");
}

function technologyStack(skills, jobMap) {
  if (jobMap.cms || skills.some((skill) => /sitecore|sxa|helix/i.test(skill))) {
    return {
      platform: "Sitecore CMS, C#, .NET, ASP.NET MVC, templates, renderings, layouts, workflows, and search integrations",
      frontend: skills.includes("React") ? "React and TypeScript components" : "responsive presentation components and Sitecore renderings",
      database: skills.includes("SQL Server") ? "SQL Server" : "content databases and relational data stores",
      architecture: "Sitecore Helix-aligned component architecture"
    };
  }
  const backendSkills = [];
  if (skills.includes("Spring Boot")) backendSkills.push("Spring Boot");
  if (skills.includes("Java")) backendSkills.push("Java");
  if (skills.includes(".NET")) backendSkills.push(".NET");
  if (skills.includes("C#")) backendSkills.push("C#");
  if (skills.includes("Node.js")) backendSkills.push("Node.js");
  const backend = backendSkills.length ? backendSkills.join(", ") : "the target technology stack";
  return {
    platform: `${backend}, service integrations, and database-backed application components`,
    frontend: skills.includes("React") ? "React and TypeScript interfaces" : "user-facing application components",
    database: skills.find((skill) => ["PostgreSQL", "Oracle", "MySQL", "SQL Server", "MongoDB"].includes(skill)) || "data persistence layers",
    architecture: skills.includes("Microservices") ? "microservices architecture" : "solution architecture"
  };
}

function bulletSet(project, level, skills, jobMap) {
  const stack = technologyStack(skills, jobMap);
  const platform = stack.platform;
  const frontend = stack.frontend;
  const database = stack.database;
  const cloud = project.cloud || skills.find((skill) => ["AWS", "Azure", "GCP"].includes(skill));
  const architecture = stack.architecture;
  const domainPurpose = `${project.domain} application used to support customer-facing operations, internal business teams, and high-volume content or transaction workflows`;

  const early = [
    `Developed assigned modules for a ${domainPurpose}, following sprint priorities, coding standards, and guidance from senior engineers.`,
    `Built and updated presentation components, validation rules, data mappings, and reusable service logic using ${platform}.`,
    `Implemented bug fixes for ${project.domain} workflows by analyzing defects, reproducing issues, updating code, and validating fixes with QA.`,
    `Created unit test coverage and supported regression testing for content authoring, page rendering, integration, and data validation scenarios.`,
    `Assisted with deployment validation, environment checks, documentation updates, and production issue triage during planned releases.`,
    `Collaborated with developers, QA analysts, and business users to understand expected behavior and deliver stable enhancements within sprint timelines.`
  ];

  const mid = [
    `Owned end-to-end feature development for a ${domainPurpose}, converting business requirements into working application functionality.`,
    `Developed ${frontend}, reusable components, content templates, service integrations, and data-driven workflows using ${platform}.`,
    `Integrated internal and external APIs for ${project.domain} workflows with structured logging, error handling, validation, and retry-ready service patterns.`,
    `Worked with product owners and business users to clarify acceptance criteria, identify edge cases, and align implementation with real application usage.`,
    `Coordinated with QA to review test scenarios, resolve defects, validate regression areas, and support release readiness across lower environments.`,
    `Enhanced existing components through refactoring, query tuning, cache-aware changes, and defect resolution to improve maintainability and production stability.`,
    `Supported deployment activities${cloud ? ` in ${cloud}` : ""} by validating configuration changes, reviewing release notes, and monitoring post-release behavior.`
  ];

  const senior = [
    `Designed and delivered scalable enhancements for a ${domainPurpose}, taking ownership from requirement analysis through release validation.`,
    `Built content models, presentation components, integration layers, and reusable application services using ${platform}.`,
    `Participated in ${architecture} discussions, technical feasibility reviews, API contract definition, data modeling, and dependency analysis for high-priority releases.`,
    `Optimized page rendering, service calls, search behavior, caching strategy, and database access patterns to improve response time and production reliability.`,
    `Led code reviews, mentored team members, and guided implementation quality across component design, error handling, logging, and test coverage.`,
    `Partnered with QA, DevOps, product owners, and business stakeholders to validate releases, resolve defects, and support production readiness${cloud ? ` on ${cloud}` : ""}.`,
    `Investigated production issues by reviewing logs, configurations, content setup, and integration behavior, then delivered fixes with clear root-cause notes.`
  ];

  const lead = [
    `Led technical delivery for a ${domainPurpose} for ${project.clientName}, owning solution design, development direction, and release readiness.`,
    `Translated product roadmap items into technical tasks, clarified implementation scope, and guided the team through design, development, testing, and production rollout.`,
    `Architected and implemented ${architecture} solutions using ${platform}${cloud ? ` and ${cloud}` : ""}, balancing scalability, maintainability, authoring flexibility, and delivery timelines.`,
    `Directed component design, content modeling, API integration strategy, code review standards, performance tuning, and production support practices across the engineering team.`,
    `Streamlined CI/CD readiness, automated testing coverage, configuration validation, monitoring, and incident response workflows to improve deployment quality.`,
    `Collaborated with product owners, architects, QA leads, DevOps engineers, and business stakeholders to translate roadmap priorities into technically sound delivery plans.`,
    `Resolved complex production issues by coordinating triage, analyzing application logs and integration dependencies, identifying root cause, and delivering permanent fixes.`
  ];

  let bullets = { early, mid, senior, lead }[level];
  if (jobMap.testing && !bullets.some((line) => /test/i.test(line))) {
    bullets = [...bullets, "Expanded automated test coverage for critical user journeys and service-layer logic to improve regression confidence."];
  }
  if (jobMap.devops && !bullets.some((line) => /CI\/CD|deployment/i.test(line))) {
    bullets = [...bullets, "Supported CI/CD pipeline validation and release coordination across lower environments and production deployments."];
  }
  return bullets;
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
    const text = `Client: ${project.clientName}                             ${project.duration}
Role: ${project.designation || suggestedDesignation(Number(years), index)}
Responsibilities:
${bullets.join("\n")}`;
    return {
      ...project,
      role: project.designation || suggestedDesignation(Number(years), index),
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

function generateResumeArtifacts(data) {
  alignProjectTimeline();
  const projects = collectProjects();
  const jobMap = analyzeJob(data.jobDescription);
  const groupedSkills = detectSkills(data.jobDescription, data.template, projects);
  const summary = buildSummary({ ...data, projects, groupedSkills, jobMap });
  const summaryLineList = summaryLines({ ...data, projects, groupedSkills, jobMap });
  const skills = buildSkillMatrix(groupedSkills);
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
    jobTitle: data.jobTitle,
    summary,
    summaryLines: summaryLineList,
    skills,
    skillLines,
    experience,
    projectBlocks,
    resume
  };
}

function generateResume(data) {
  return generateResumeArtifacts(data).resume;
}

function formData() {
  return Object.fromEntries(new FormData(form).entries());
}

function seed() {
  uploadedDocxTemplate = null;
  latestResumeArtifacts = null;
  templateArea.value = sampleTemplate;
  projectsEl.innerHTML = "";
  defaultProjects.forEach((project) => addProject(project));
  alignProjectTimeline();
  outputEl.textContent = "";
  statusText.textContent = "Ready";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  latestResumeArtifacts = generateResumeArtifacts(formData());
  outputEl.textContent = latestResumeArtifacts.resume;
  statusText.textContent = "Generated with year-aligned project experience";
});

document.querySelector("#addProjectBtn").addEventListener("click", () => addProject());
document.querySelector("#useSampleBtn").addEventListener("click", () => {
  uploadedDocxTemplate = null;
  templateArea.value = sampleTemplate;
});
document.querySelector("#resetBtn").addEventListener("click", seed);
yearsInput.addEventListener("input", alignProjectTimeline);

document.querySelector("#jobDescriptionFile").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await extractFileText(file);
    if (!text.trim()) throw new Error("No readable text was found in this file.");
    form.elements.jobDescription.value = text;
    statusText.textContent = `Loaded job description from ${file.name}`;
  } catch (error) {
    statusText.textContent = error.message;
  }
});

document.querySelector("#templateFile").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    uploadedDocxTemplate = null;
    const text = await extractFileText(file);
    if (!text.trim()) throw new Error("No readable text was found in this template.");
    templateArea.value = text;
    if (file.name.toLowerCase().endsWith(".docx")) {
      uploadedDocxTemplate = {
        name: file.name,
        buffer: await file.arrayBuffer()
      };
    }
    statusText.textContent = `Loaded resume template from ${file.name}`;
  } catch (error) {
    statusText.textContent = error.message;
  }
});

document.querySelector("#copyBtn").addEventListener("click", async () => {
  if (!outputEl.textContent.trim()) return;
  await navigator.clipboard.writeText(outputEl.textContent);
  statusText.textContent = "Copied";
});

document.querySelector("#downloadBtn").addEventListener("click", async () => {
  const artifacts = latestResumeArtifacts || generateResumeArtifacts(formData());
  latestResumeArtifacts = artifacts;
  if (!outputEl.textContent.trim()) {
    outputEl.textContent = artifacts.resume;
  }

  if (!uploadedDocxTemplate) {
    statusText.textContent = "Upload your .docx resume template first to download in the exact Word format.";
    return;
  }

  try {
    const docxBlob = await buildDocxFromUploadedTemplate(artifacts);
    downloadBlob(docxBlob, "skilled-resume.docx");
    statusText.textContent = "Downloaded skilled resume in uploaded Word template format";
  } catch (error) {
    statusText.textContent = error.message;
  }
});

seed();
