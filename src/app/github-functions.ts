import { Octokit } from "octokit";

export async function getGithubRepositories(owner: string, repo: string, token: string) {
    try {
        const octokit = new Octokit({
            auth: token,
        });

        const response = await octokit.request(`GET /repos/${owner}/${repo}`, {
            owner: owner,
            repo: repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error fetching GitHub repositories:", error);
        throw error;
    }
}


export async function listUserRepos(token: string) {
    try {
        const octokit = new Octokit({
            auth: token,
        });

        const response = await octokit.request("GET /user/repos", {
            per_page: 100,
            sort: "updated",
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error listing GitHub repositories:", error);
        throw error;
    }
}
