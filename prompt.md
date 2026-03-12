We are going to create a relatively simple webgame using Python. 

Stage 1 is to populate the @initial_design.md markdown document. Let's have an open discussion about what features should be included before finalizing the document. I'll start by listing intial features for a starting point.

morp is a game inspired by codenames, among us, and vorp (in the game bogos binted). When a group of 3 or more player queues up for a game, they will start with 3 health and be presented with a table of n*n words falling under a certain theme (e.g, spooky things: monster, ghost, zombie, demon, etc). Among the selection of words presented to all players, one randomly selected word will be designated as the true word and highlighted in green on the board. There will be one player in the lobby designated as the "morp" (the imposter) at the start of a round. The morp cannot see the highlighted word and must try and blend in with the "safe" players or risk being outed in the voting session following each round. On their turn, each safe player must provide a clue/hint to let the other players know that they are safe and see the selected word, while not giving away the answer to the morp. On the morps turn, they will have to use the hints provided by other players to provide their own reasonable answer even if they haven't determined what the selected word is yet. If the morp goes first, they will see half of the table of words, to balance having no hints to go off. After all players have given their answer, a voting phase will begin where players accuse each other of being the morp. Whoever gets the most total votes is then accused. and player roles are revealed. If anyone but the morp is accused, the morp get to do 1 damage to a player of their choosing. If the morp is accused, they must guess the selected word from the board. If they fail to guess the selected word, they take 1 damage. Each turn the active board is randomized and a random word is selected as the target word. When 2 players remain, it will go into a special scenario which is described below.

2-Player Scenario Ideas:
- Let all the dead people say hints and whoever guesses it first is safe. The player who does not guess in time takes 1 damage. All dead players hold up hints at the same time.
- overall goal here is to make it quick and snappy so people can go on to the next round, kind of like a "shoot out"

General Requirements:
- We will start with a general collection of 3 5x5 sample boards which will be the default "board pool", but we will allow the users to input custom lists of boards once we are past the intial stages.
- Will need at least 3 players to start a game
- Python will be required for the backend, frontend implementation is up for discussion. (a simple html page will suffice for backend testing though)

Additional Features:
- Ability to configure lobby size and number of morps per game. This should probably impact how voting works but I'm not sure if players should vote for more than one player at a time and accuse the top 2 players or have players vote twice. Definitely a point of discussion.
- ability to create a collection of custom boards. Probably accepts json structure {{"board_hint": "something spooky...", "words": [...]}, {...}}.

Open Questions:
- How voting should work if there is more than one morp.
- Best way to implement this game. I'm most comfortable with Python but am willing to branch out where necessary for the sake of maintainability and ease of development.

Future Goals (Out of scope for prototype phase but worth noting so we don't block ourselves from future features):
- Lobby Chat
- Ability to draw answers as well as enter text hints. Toggleable at lobby create for if answers are text, drawing, or allow both.
- Little customizable player orbs that hold up their hints after each player
- Ability for player orbs to interact with each other (e.g. point. middle finger, spit, OK hand sign, etc)
- Ability to change max length of user response allowed at lobby creation. 
- Works on mobile or desktop
- Number of starting lives is configurable
- Fun ways for the eliminated players to heckle/interact with the game

Release Scope:
This is a game I want to primarily make available for my friends and family over the internet. I will likely host it in AWS with a special key needed to access it and lots of lockdowns on how much spend can be allocated. Do not think hard about the AWS hosting process at this stage just be aware of the goal without concern of the complexities yet.

Potential Validation Steps:
Stage 0: Review project goal, ask clarifying questions, address any gaps. Create documentation for requirements, user stories, key test cases, etc. Breakdown blocking features, and what to prioritize now vs later in development.
Stage 1: When initial scaffolding of backend is complete, user test against a barebones frontend built only for testing the backend.
Stage 2: Continue expanding backend to have all core mechanics, begin expanding frontend features and start preparing backend features in response to frontend needs.
Stage 3: Finalize backend core, continue developing front end user experience
Stage 4: Prepare for AWS deployment. Lockdown access for early online testing.
Stage 5: Prepare for wider release. Ensure resources are sufficient and costs are measured/limited. potentially a ko-fi link at this stage
Stage 5: Iterative development, adding more skins, orb interactions, etc
Stage 6: If a couple unobtrusive ads are required to keep site sustaining itself, they may be added here

Frontend User Experience Concept:
The top half of the screen contains the board of potential words. We want board size to be configurable so it should be able to render any n*k array of words up to a reasonable limit. The bottom half of the screen contains the lobby avatars, customizable orbs which can have combinations of color, mouth, eyes, nose, hats, and accessories. As each player locks in their answer, a speech bubble appears over their head and remains there until voting has concluded. At any point in the game, users can have their orb interact with other players’ in various ways. They can point, plea, nod, shake head, spit at, slap, etc with room for adding more later (this won’t have to be as scalable as adding new cosmetic art or word boards). As players are eliminated, their orbs pop and they turn into a ghost version of their orb. When two players remain, they are put in the center and the eliminated players surround them. Both the final 2 players are set as the morp and the eliminated players can all see the target word. All eliminated players will have the same timer to hold up a hint and the first of the morps to guess the correct word is safe, while the other takes one damage. A new board and target word are selected and the process repeats until one player remains.

Key Philosophy: Test Driven Development