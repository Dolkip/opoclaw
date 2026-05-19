import { resolve, relative, join } from "path";
import { WORKSPACE_DIR } from "./workspace.ts";
import { existsSync, readdirSync } from "fs";

const SKILLS_DIR = resolve(WORKSPACE_DIR, "skills");

function isSafeSkillName(name: string): boolean {
    return /^[A-Za-z0-9._-]+$/.test(name);
}

function getSkillFilePath(name: string): string {
    if (!isSafeSkillName(name)) {
        throw new Error("Invalid skill name.");
    }
    const filename = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
    if (filename.includes("/") || filename.includes("\\")) {
        throw new Error("Invalid skill path.");
    }
    const abs = resolve(join(SKILLS_DIR, filename));
    const rel = relative(SKILLS_DIR, abs);
    if (rel.startsWith("..") || rel.includes("/../")) {
        throw new Error("Invalid skill path.");
    }
    return abs;
}

export async function listSkills(): Promise<string[]> {
    const skills: string[] = [];

    if (!existsSync(SKILLS_DIR)) return [];

    const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const e of entries) {
        if (!e.isFile()) continue;
        const fileName = e.name;
        if (!fileName.toLowerCase().endsWith(".md")) continue;
        const name = fileName.replace(/\.md$/i, "");
        if (!isSafeSkillName(name)) continue;
        skills.push(name);
    }

    return skills.sort();
}

export async function readSkill(name: string): Promise<string> {
    const path = getSkillFilePath(name);
    const file = Bun.file(path);
    if (!(await file.exists())) {
        throw new Error("Skill not found.");
    }
    return await file.text();
}

export const useSkill = readSkill;
