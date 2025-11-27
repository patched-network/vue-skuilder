Part of the overall vision here is for an evolutionary approach in the spirit of (but not necessarily exactly resembling in implementation):

- N strategies exist
- M users exist
- users have *goals* (learning outcomes)
- a strategy is effective if its usage improves goal achievement

we continually multi-arm-bandit all of the strategies - applying or bypassing them accoring to our perceived probability of its utility

(eg, if we're 90% sure it's useful, it gets served to 90% of users)

- cohort differences in achievement, overall progress through course materials, and engagement (gross - least weight), 

each of N strategies divides into cohorts via some hashId collision metric
-  eg: h( strategyHash + slowRotationSalt) xor userHash 
       if resultant Ones are < utilityConfidence percent of total bits, then include the strategy for the user


- we rotate the salt so that no idividual gets trapped indefinitely using a very poor strategy or prohibited from a very effective one. May be a wash if there are very many strategies.
  - but - cannot rotate all that often, or unable to measure effects (?)


for new strategies, we set an intuitive initial utilityConfidence


CONSIDERATIONS:
- system grinds to halt if number of strategies grows indefinitely, for sake of 'computation' overhead
- different 


Here, a strategy could be any specific instance of a given NavigationStrategy type, including things like
- proficiency (defined by user ELO) in tag X indicates that a user is prepared to take on tag y
  - and more generally - tags x,y,z -> card X, or cards a or b or c -> tag Y
  - collectively, encoding the heirarchical knowledge hypergraph - individual items as prereqs and postreqs, but also collections of items as prereqs and postreqs
- A and B are interference candidates - separate their introduction
- would like to extend into parameterizable / programmable strategies. eg, should be able to specify deps like `grade-{n}` & `geometry` -> `grade-{n+1}` & `geometry` (eg, demonstrated mastery of grade n geometry indicates readiness for grade n+1 geometry). Moreover: `grade-{n}` & `{freeVariable}` -> `grade-{n+1}` & `{freeVariable}`


---
---

meta-consideration
- content itself can/should be subject to this selection pressure. 
- te system wants to be welf-healing
  - identifying learning 'barriers' where substantive portion of cohort gets stuck or abandons
  - surfacing that info in a useful way
  - author (individial publisher, community, LLM agent) aims to diagnose and remedy by providing, eg, intermediate content among the trouble area, or alternate navitation strategies / scaffolding techniques to 
  - goal: continued optimistic progression of eg, cohort members who made it through under the prior arrangement, but a robust intervention system according to observed needs
- Can incentivise creation of high utility content / pedagogical strategy
