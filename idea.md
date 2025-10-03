# idea

## agents: 

- vercel ai sdk agents
    - user interaction agent 
        - system prompts like poke 
        - llama 4 
    - code reviewer agent
        - needs to review code 
        - needs to take notes about the code
        - needs to save those files as the context engine
    - unit test writing agent
        - reading context files
        - writing unit tests based on context  
        - save files for unit tests
    - docker deployment agent 
        - docker mcp 
        - create sandbox env 
        - deploy and run sandbox env
    - results evaluator agent
        - sees the results from sandbox env 
        - generates detailed analysis 

## things to think about 


- orchestration?
- where do these agents store shared context?
- repo ingestion strategy? 
- embeddings vs selective files? 
- evaluation metrics?
    - code reviewer: signal quality rubric(readability, complexity)
    - unit tests: coverage proxy (lines/functions touched), mutation score? if time.
    - sandbox results: pass/fail, performance, logs surfaced to user.
    - aggregate score and insights.
- secrets handling?
- sandbox infra?
- tooling/mcp
- ui/ux
- which model for each agent?
- github api?
- supported stacks?
- auth? better auth? 
- db? perhaps convex?
