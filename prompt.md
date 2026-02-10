We are going to create a relatively simple webgame using Python. 

Stage 1 is to populate the @initial_design.md markdown document. Let's have an open discussion about what features should be included before finalizing the document. I'll start by listing intial features for a starting point.

morp is a game inspired by codenames, among us, and vorp (in the game bogos binted). When a group of 3 or more player queues up for a game, they will start with 3 health and be presented with a table of n*n words falling under a certain theme (e.g, spooky things: monster, ghost, zombie, demon, etc). Among the selection of words presented to all players, one randomly selected word will be designated as the true word and highlighted in green on the board. There will be one player in the lobby designated as the "morp" (the imposter) at the start of a round. The morp cannot see the highlighted word and must try and blend in with the "safe" players or risk being outed in the voting session following each round. On their turn, each safe player must provide a clue/hint to let the other players know that they are safe and see the selected word, while not giving away the answer to the morp. On the morps turn, they will have to use the hints provided by other players to provide their own reasonable answer even if they haven't determined what the selected word is yet. If the morp goes first, they will see half of the table of words, to balance having no hints to go off. After all players have given their answer, a voting phase will begin where players accuse each other of being the morp. Whoever gets the most total votes is then accused. and player roles are revealed. If anyone but the morp is accused, the morp get to do 1 damage to a player of their choosing. If the morp is accused, they must guess the selected word from the board. If they fail to guess the selected word, they take 1 damage. I want to workshop what happens when 2 players remain, so I'm leaving a blank space there for now.

Additional Features:
- Ability to configure lobby size and number of morps per game. This should probably impact how voting works but I'm not sure if players should vote for more than one player at a time and accuse the top 2 players or have players vote twice. Definitely a point of discussion.
- ability to create a collection of custom boards. Probably accepts json structure {{"board_hint": "something spooky...", "words": [...]}, {...}}.

Open Questions:
- How voting should work if there is more than one morp.
- What happens when 2 players remain
- Best way to implement this game. I'm most comfortable with Python but am willing to branch out where necessary for the sake of maintainability and ease of development.

Future Goals (Out of scope for prototype phase but worth noting so we don't block ourselves from future features):
- Lobby Chat
- Ability to draw answers as well as enter text hints. Toggleable at lobby create for if answers are text, drawing, or allow both.
- Little customizable player orbs that hold up their hints after each player
- Ability for player orbs to interact with each other (e.g. point. middle finger, spit, OK hand sign, etc)
- Ability to change max length of user response allowed at lobby creation. 
- Works on mobile or desktop
- Number of starting lives is configurable

2-Player Scenario Ideas:
- Final 2 players participate in a shootout. 3rd Place Player has a button to start the shootoff, after the light turns green, the last two players will try to react faster and hit the shoot button first. Whoever is last loses one life. This goes on until one player is out of lives.
- Some form of rock paper scissors, likely abstracted somewhat to make it more entertaining
- overall goal here is to make it quick and snappy so people can go on to the next round

Release Scope:
This is a game I want to primarily make available for my friends and family over the internet. I will likely host it in AWS with a special key needed to access it and lots of lockdowns on how much spend can be allocated. Do not think hard about the AWS hosting process at this stage just be aware of the goal without concern of the complexities yet.