shared = require('./web/shared');

shared.actions.interrogate = undefined;

/**
 * Randomly chooses an index based on a supplied vector of weights or choice count
 * If choices is a number, then all choices are given even weight
 * @param {Array<number> | number} choices 
 * @returns {number} the randomly chosen index
 */
const randomChoose = function(choices) {
    if (typeof(choices) == 'number') {
        return Math.floor(Math.random() * choices);
    }

    if (Array.isArray(choices)) {

    }

    throw Exception("Passed in a non array or number into randomChoose");
}

/**
 * Node Prototype:
 * 
 * State state - The current game state the node represents
 * number timesPlayed - the number of times the node has been played through
 * Node parent - The parent node
 * Node children - The children that can be reached by one discrete action from the node
 */


/**
 * Constructor for a Node object
 * 
 * @param {State} state The state for the node to represent
 * @param {Node} parent parent of the node.  Defaults to null
 */
function Node(state, parent=null) {
    this.state = state;
    this.parent = parent;
    this.expanded = false;
    this.children = [];
    this.terminal = !!state.state.winnderIdx;
    this.wins = 0;
    this.plays = 0;

    // Generate the actions allowed by the state:
    this.availableActions = allowedActions(state);

    this.expand = () => {
        this.children = this.availableActions.map(action => new Node(this.getStateTransition(state, action), this));
    }
}

// The cards in the center pile that can be randomly selected for the exchange action
let cardsInCenter = function(state) {
    const gameDeck = [
        {
            role: 'assassin',
            count: 3,
        },
        {
            role: 'captain',
            count: 3,
        },
        {
            role: 'ambassador',
            count: 3,
        },
        {
            role: 'duke',
            count: 3,
        },
        {
            role: 'contessa',
            count: 3,
        },
    ];
    // See whats in players hands.  Anything not in a players hand is a card in the center
    // remove cards in the players hand from the game deck
    for (let player of state.players) {
        for (let influence of player.influence) {
            gameDeck.find(c => c.role === influence.role).count--;
        }
    }
    // decompress the game deck into an array
    const centerCards = [];
    for (let cardType of gameDeck) {
        while (cardType.count > 0) {
            centerCards.push(cardType.role);
            cardType--;
        }
    }
    return centerCards;
}

/**
 * Given an array of options, returns an array of all possible pairs of choices
 * @param {} options 
 */
let setsOfTwo = function(options) {
    pairs = [];
    for (let i=0; i<options.length; i++) {
        for (let j=0; j<options.length; j++) {
            if (i == j) {
                continue;
            }
            pairs.push([options[i], options[j]]);
        }
    }
}

let allowedActions = function(state) {
    const currentPhase = state.state.name;
    const phases = shared.states;

    const allowedActions = [];
    
    if (currentPhase == phases.START_OF_TURN) {
        // can only coup if have 10 cash or more
        if (state.players[state.state.playerIdx].cash >= 10) {
            // need to pick all valid targets
            for (let i=0; i < state.state.numPlayers; i++) {
                if (state.players[i].influenceCount > 0) {
                    allowedActions.push({
                        command: 'play-action',
                        action: 'coup',
                        target: i,
                    });
                }
            }
        }
        else {
            for( let action of shared.actions.keys() ) {
                actionObj = shared.actions[action]
                if (players[state.state.playerIdx].case >= actionObj.cost) {
                    if (!actionObj.targeted) {
                        allowedActions.push({
                            command: 'play-action',
                            action: action,
                        });
                    }
                    // need to pick all valid targets - that is, people still in the game
                    else {
                        for (let i=0; i < state.state.numPlayers; i++) {
                            if (state.players[i].influenceCount > 0) {
                                allowedActions.push({
                                    command: 'play-action',
                                    action: action,
                                    target: i,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    /* Every player needs an opportunity to challenge here
     * This is handled asynchronously in the engine, but must be synchronous for MCTS
     * To do this, we append another attribute to the state, `responseIDx` which corresponds to
     * which player's turn it is to respond.  This should be appended by the caller
     */
    else if (currentPhase == phases.ACTION_RESPONSE) {
        // Each player chooses to either challenge, allow, or block if able
        // determine if block is allowed - if targeted, player must be the target to block
        let canBlock;
        if (shared.actions[state.state.action].targeted && shared.actions[state.state.action].blockedBy 
            && state.state.target === state.state.responseIDx) {  // Targeted and responding player is the targe
                canBlock = true;
        }
        else if (shared.actions[state.state.action].blockedBy) {
            canBlock = true;
        }
        else {
            canBlock = false;
        }

        allowedActions.concat([{
            command: 'allow',
        },
        {
            command: 'challenge',
        }]);
        if (canBlock) {
            // Need to add all the possible blocking roles
            for (const blockingRole of shared.actions[state.state.action].blockedBy) {
                allowedActions.push({
                    command: 'block',
                    blockingRole: blockingRole,
                });
            }
        }
    }
    /*
     * In this phase, someone has already challenged and failed, so the target gets a chance to block here if they would like
     */
    else if (currentPhase == phases.FINAL_ACTION_RESPONSE) {
        let canBlock;
        if (shared.actions[state.state.action].targeted && shared.actions[state.state.action].blockedBy 
            && state.state.target === state.state.responseIDx) {  // Targeted and responding player is the targe
                canBlock = true;
        }
        else if (shared.actions[state.state.action].blockedBy) {  // Anyone can block
            canBlock = true;
        }
        else {
            canBlock = false;
        }

        allowedActions.push({
            command: 'allow',
        });
        if (canBlock) {
            // Need to add all the possible blocking roles
            for (const blockingRole of shared.actions[state.state.action].blockedBy) {
                allowedActions.push({
                    command: 'block',
                    blockingRole: blockingRole,
                });
            }
        }
    }
    /*
     * In this phase, anyone is allowed to challenge a blocking action
     */
    else if (currentPhase == phases.BLOCK_RESPONSE) {
        allowedActions.concat([{
            command: 'allow',
        },
        {
            command: 'challenge',
        }]);
    }
    else if (currentPhase == phases.REVEAL_INFLUENCE) {
        if (state.state.responseIDx === state.state.playerToReveal) {
            // allowed to reveal any of the cards this player has that are unrevealed
            for (let i=0; i<state.players[responseIDx].influence.length; i++) {
                if (!state.players[responseIDx].influence[i].revealed) {
                    allowedActions.push({
                        command: 'reveal',
                        role: state.players[responseIDx].influence[i].role,
                    });
                }
            }
        }
    }
    else if (currentPhase == phases.EXCHANGE) {
        const options = state.state.exchangeOptions;
        // need to add all ways of selecting two of these options if both influence in hand
        if (state.state.players[playerIdx].influenceCount === 2) {
            pairs = setsOfTwo(options);
            for (let i=0; i<pairs.length; i++) {
                allowedOptions.push({
                    command: 'exchange',
                    roles: [pairs[0], pairs[1]],
                });
            }
        }
        else { // Only 1 influence left, only grab one
            for (let option of options) {
                allowedActions.push({
                    command: 'exchange',
                    roles: [option],
                });
            }
        }
    }
    return allowedActions;
}

// https://medium.com/@tkssharma/objects-in-javascript-object-assign-deep-copy-64106c9aefab
function cloneObject(obj) {
    var clone = {};
    for(var i in obj) {
        if(obj[i] != null && typeof(obj[i])=="object")
            clone[i] = cloneObject(obj[i]);
        else
            clone[i] = obj[i];
    }
    return clone;
}

const nextAlivePlayerIdx = function(state, startingIndex) {
    const testIndex = (startingIndex + 1) % state.players.length;
    while (state.state.players[testIndex].influenceCount == 0) {
        testIndex++;
    }
    return testIndex;
}

const resolveForeignAid = function(stateToUpdate) {
    stateToUpdate.player[stateToUpdate.state.playerIdx].cash += 2;
    stateToUpdate.state.playerIdx = nextAlivePlayerIdx(stateToUpdate, stateToUpdate.state.playerIdx);
    stateToUpdate.state.action = null;
    stateToUpdate.state.name = shared.state.START_OF_TURN;
}

const resolveTax = function(stateToUpdate) {
    stateToUpdate.player[stateToUpdate.state.playerIdx].cash += 3;
    stateToUpdate.state.playerIdx = nextAlivePlayerIdx(stateToUpdate, stateToUpdate.state.playerIdx);
    stateToUpdate.state.action = null;
    stateToUpdate.state.name = shared.state.START_OF_TURN;
}

const resolveAssassinate = function(stateToUpdate) {
    stateToUpdate.state.action = null;
    stateToUpdate.state.name = shared.states.REVEAL_INFLUENCE;
    stateToUpdate.state.playerToReveal = stateToUpdate.state.target;
}

const resolveSteal = function(stateToUpdate) {
    if (stateToUpdate.players[stateToUpdate.state.target].cash >= 2) {
        stateToUpdate.player[stateToUpdate.state.playerIdx].cash += 2;
        stateToUpdate.players[stateToUpdate.state.target].cash -= 2;
    }
    else {
        stateToUpdate.player[stateToUpdate.state.playerIdx].cash += stateToUpdate.players[stateToUpdate.state.target].cash;
        stateToUpdate.players[stateToUpdate.state.target].cash = 0;
    }
    stateToUpdate.state.playerIdx = nextAlivePlayerIdx(stateToUpdate, stateToUpdate.state.playerIdx);
    stateToUpdate.state.action = null;
    stateToUpdate.state.name = shared.state.START_OF_TURN;
}

const resolveExchange = function(stateToUpdate) {
    stateToUpdate.state.name = shared.states.EXCHANGE;
    // pick two cards from the center
    const centerCards = cardsInCenter(stateToUpdate);
    const firstCard = centerCards.splice(randomChoose(centerCards.length), 1)[0];
    const secondCard = centerCards.splice(randomChoose(centerCards.length), 1)[0];
    stateToUpdate.state.exchangeOptions = [firstCard, secondCard].concat(stateToUpdate.players[playerIdx].map(i => i.role).filter(i => !i.revealed));
}

/**
 * Takes a state and returns a new state after the action has been applied
 * Does not validate the actionCommand against the state
 * @param {*} state 
 * @param {*} actionCommand 
 */
const getStateTransition = function(state, actionCommand) {
    const stateCopy = cloneObject(state);
    // parse the command
    // the usual actions like income, coup, foreign-aid and the like
    // puts the player into revealState
    if (actionCommand.command === 'play-action') {
        if (actionCommand.action === 'coup') {
            stateCopy.state.name = shared.states.REVEAL_INFLUENCE;
            stateCopy.state.responseIDx = actionCommand.target;
            stateCopy.state.playerToReveal = actionCommand.target;
            stateCopy.players[state.state.playerIdx].cash -= 7;
        }
        else if (actionCommand.action === 'income') {
            stateCopy.players[state.state.playerIdx].cash += 1;
            stateCopy.state.playerIdx = nextAlivePlayerIdx(state, stateCopy.state.playerIdx);
        }
        else if (actionCommand.action === 'foreign-aid') {
            stateCopy.state.name = shared.states.ACTION_RESPONSE;
            stateCopy.state.action = actionCommand.action;
        }
        else if (actionCommand.action === 'tax') {
            stateCopy.state.name = shared.states.ACTION_RESPONSE;
            stateCopy.state.action = actionCommand.action;
        }
        else if (actionCommand.action === 'assassinate') {
            stateCopy.state.name = shared.states.ACTION_RESPONSE;
            stateCopy.state.action = actionCommand.action;
            stateCopy.state.target = actionCommand.target;
        }
        else if (actionCommand.action === 'steal') {
            stateCopy.state.name = shared.states.ACTION_RESPONSE;
            stateCopy.state.action = actionCommand.action;
            stateCopy.state.target = actionCommand.target;
        }
        else if (actionCommand.action === 'exchange') {
            stateCopy.state.name = shared.states.ACTION_RESPONSE;
            stateCopy.state.action = actionCommand.action;
        }
    }
    // If block, then need to give the block response to everyone
    else if (actionCommand.command === 'block') {
        const blockingPlayer = state.state.responseIDx;
        stateCopy.state.responseIDx = nextAlivePlayerIdx(state, stateCopy.state.responseIdx);
        stateCopy.state.name = shared.states.BLOCK_RESPONSE;
        stateCopy.state.blockingRole = actionCommand.blockingRole;
        stateCopy.state.blockingPlayer = blockingPlayer;
    }
    // Need to determine the winner of the challenge and proceed accordingly
    else if (actionCommand.command === 'challenge') {
        // Determine winner of challenge
        if (state.state.name === shared.states.BLOCK_RESPONSE) {
            let disputedRole = state.state.blockingRole;
            // Check if player has the disputed role
            const disputedInfluenceIndex = state.players[state.state.responseIDx].influence.find(i => i.role === disputedRole);
            if (disputedInfluenceIndex) {
                // unsuccessful challenge - challenger must reveal a card
                stateCopy.state.name = shared.states.REVEAL_INFLUENCE;
                stateCopy.state.responseIDx = state.state.responseIDx;
                stateCopy.state.playerToReveal = state.state.responseIDx;
                // challengee also gets a new influence and returns the challenged one
                const newCardPool = cardsInCenter(state).concat(state.players[state.state.blockingPlayer].influence[disputedInfluenceIndex]);
                const newCard = newCardPool[randomChoose(newCardPool.length)];
                stateCopy.players[state.state.blockingPlayer].influence[disputedInfluenceIndex].role = newCard;
            }
            else {
                // successful challenge - blocking player must reveal and block fails
                stateCopy.state.name = shared.states.REVEAL_INFLUENCE;
                stateCopy.state.responseIDx = state.state.blockingPlayer;
                stateCopy.state.playerToReveal = state.state.blockingPlayer;
                stateCopy.state.blockingRole = null;
                stateCopy.state.blockingPlayer = undefined;
            }
        }
        else if (state.state.name === shared.states.ACTION_RESPONSE) {
            let disputedRole = shared.actions[state.state.action].roles;
            // This is because both inquisitors and ambassadors can exchange, so special handling like this is required
            if (Array.isArray(disputedRole)) {
                disputedRole = disputedRole[0]; 
            }
            // Check if player has the disputed role
            const disputedInfluenceIndex = state.players[state.state.responseIDx].influence.findIndex(i => i.role === disputedRole);
            if (disputedInfluenceIndex) {
                // unsuccessful challenge - challenger must reveal a card
                stateCopy.state.name = shared.states.REVEAL_INFLUENCE;
                stateCopy.state.responseIDx = state.state.responseIDx;
                stateCopy.state.playerToReveal = state.state.responseIDx;
                // challengee also gets a new influence and returns the challenged one
                const newCardPool = cardsInCenter(state).concat(state.players[state.state.playerIdx].influence[disputedInfluenceIndex]);
                const newCard = newCardPool[randomChoose(newCardPool.length)];
                stateCopy.players[state.state.playerIdx].influence[disputedInfluenceIndex].role = newCard;
            }
            else {
                // successful challenge - playing player must reveal and action fails
                stateCopy.state.name = shared.states.REVEAL_INFLUENCE;
                stateCopy.state.responseIDx = state.state.playerIdx;
                stateCopy.state.playerToReveal = state.state.playerIdx;
                stateCopy.state.action = null;
            }
        }
    }
    else if (actionCommand.command === 'allow') {
        stateCopy.state.responseIDx = nextAlivePlayerIdx(state, stateCopy.state.responseIdx);
        if (state.state.name === shared.states.ACTION_RESPONSE) {
            // Everyone has allowed the action; resolve it
            if (stateCopy.state.responseIDx === state.state.playerIdx) {
                stateCopy.state.responseIDx = undefined;
                switch (state.state.action) {
                    case 'foreign-aid': 
                        resolveForeignAid(stateCopy);
                        break;
                    case 'tax':
                        resolveTax(stateCopy);
                        break;
                    case 'assassinate':
                        resolveAssassinate(stateCopy);
                        break;
                    case 'steal':
                        resolveSteal(stateCopy);
                        break;
                    case 'exchange': 
                        resolveExchange(stateCopy);
                        break;
                    default:
                        throw Exception('unrecognized action');
                }
            }  // Otherwise, the next player gets the chance to block or challenge
        }
        else if (state.state.name === shared.states.FINAL_ACTION_RESPONSE) {
            // no other player should need to respond in this case
            stateCopy.state.responseIDx = undefined;
            switch (state.state.action) {
                case 'assassinate':
                    resolveAssassinate(stateCopy);
                    break;
                case 'steal':
                    resolveSteal(stateCopy);
                    break;
                default:
                    throw Exception('unrecognized action for final action response');
            }
        }
        else if (state.state.name === shared.states.BLOCK_RESPONSE) {
            stateCopy.state.responseIDx = undefined;
            // Everyone has allowed the block; resolve it - i.e. progress to the next player's turn
            if (stateCopy.state.responseIDx === state.state.playerIdx) {
                stateCopy.state.responseIDx = undefined;
                switch (state.state.action) {
                    case 'assassinate':
                        stateCopy.players[state.state.playerIdx].cash -= 3;
                    case 'foreign-aid': 
                    case 'tax':
                    case 'steal':
                    case 'exchange': 
                        stateCopy.state.blockingPlayer = undefined;
                        stateCopy.state.blockingRole = null;
                        stateCopy.state.playerIdx = nextAlivePlayerIdx(state, stateCopy.state.playerIdx);
                        stateCopy.state.name = shared.states.START_OF_TURN;
                        break;
                    default:
                        throw Exception('unrecognized action');
                } 
            }  // Otherwise, the next player gets the chance to block or challenge
        }
    }
    else if (actionCommand.command === 'reveal') {
        // reveal the influence
        roleToRevealIndex = state.players[state.state.playerToReveal].influence.findIndex(i => i.role === actionCommand.role);
        stateCopy.players[state.state.playerToReveal].influenceCount--;
        stateCopy.players[state.state.playerToReveal].influence[roleToRevealIndex].revealed = true;
        // Resume normal game flow - need to know what was happening before entering reveal state
        // if there is a block in play, or the action has been nullified, then we proceed to the next player
        // if there is an action, then the action goes through
        if (state.state.blockingRole || !state.state.action) {
            if (state.state.action === 'assassinate' && state.state.blockingRole) {
                stateCopy.players[playerIdx].cash -= 3;
            }
            // proceed to next player
            stateCopy.state.blockingPlayer = undefined;
            stateCopy.state.blockingRole = null;
            stateCopy.state.playerIdx = nextAlivePlayerIdx(state, stateCopy.state.playerIdx);
            stateCopy.state.name = shared.states.START_OF_TURN;
        }
        else { // need to resolve action still
            switch (state.state.action) {
                case 'foreign-aid': 
                    resolveForeignAid(stateCopy);
                    break;
                case 'tax':
                    resolveTax(stateCopy);
                    break;
                case 'assassinate':
                    resolveAssassinate(stateCopy);
                    break;
                case 'steal':
                    resolveSteal(stateCopy);
                    break;
                case 'exchange': 
                    resolveExchange(stateCopy);
                    break;
                default:
                    throw Exception('unrecognized action');
            }
        }
        // someone could have won at this point; check for a winner
        const playersAlive = state.players.filter(p => p.influence > 0).length;
        if (playersAlive <= 1) {  // someone has won
            state.state.name = shared.states.WAITING_FOR_PLAYERS;
            state.state.winnderIdx = state.players.findIndex(p => p.influence > 0);
        }
    }
    // player exchanges cards then we proceed to the next players turn
    else if (actionCommand.command === 'exchange') {
        // Set the two chosen cards to be the players hand if we need two
        if (state.players[playerIdx].influenceCount === 2) {
            state.players[playerIdx].influence = [
            {
                role: actionCommand.roles[0],
                revealed: false,
            },
            {
                role: actionCommand.roles[1],
                revealed: false,
            },
        ]}
        else { // influenceCount is 1
            unrevealedIndex = state.players[playerIdx].influence.findIndex(i => !i.revealed);
            state.players[playerIdx].influence[unrevealedIndex] = {
                role: actionCommand.roles[0],
                revealed: false,
            }
        }
        // advance to next players turn
        stateCopy.state.playerIdx = nextAlivePlayerIdx(state, stateCopy.state.playerIdx);
        stateCopy.state.name = shared.states.START_OF_TURN;
    }

    return stateCopy;
}

// plays out the rest of the game with random moves from all players and returns the winner
const randomPlayout = function(state) {
    while (!state.state.winnderIdx) {
        const possibleActions = allowedActions(state);
        const actionChoice = possibleActions[randomChoose(possibleActions.length)];
        state = getStateTransition(state, actionChoice);
    }
    return state.state.winnderIdx;
}

// Randomly assigns a role to each unknown role for each player
const randomDetermination = function(state) {
    const stateCopy = cloneObject(state);
    const gameDeck = [
        {
            role: 'assassin',
            count: 3,
        },
        {
            role: 'captain',
            count: 3,
        },
        {
            role: 'ambassador',
            count: 3,
        },
        {
            role: 'duke',
            count: 3,
        },
        {
            role: 'contessa',
            count: 3,
        },
    ];
    // first find all known roles and remove them from the deck
    for (let player of state.players) {
        for (let influence of player.influence) {
            if (influence.role !== 'unknown') {
                gameDeck.find(r => r.role === influence.role).count--;
            }
        }
    }
    const availableCards = gameDeck.reduce((acc, cardType) => {
        const cards = [];
        while(cardType.count > 0) {
            cards.push(cardType.role);
            cardType.count--;
        }
        return acc.concat(cards);
    }, []);

    // randomly assign a card from the available cards to every unknown card in the state
    for (let player of stateCopy.players) {
        for (let influence of player.influence) {
            if (influence.role === 'unknown') {
                influence.role = availableCards.splice(randomChoose(availableCards.length),1);
            }
        }
    }
}

const upperConfidenceBound = function(node) {
    return (node.wins / node.plays) + Math.sqrt((2 * Math.log(node.parent.plays)) / node.plays);
}

const monteCarloTreeSearch = function(state, playouts, searchingPlayer) {
    // create the root node with a random determination
    const rootNode = new Node(randomDetermination(state));
    rootNode.expand();
    let i = 0;

    const bestPlay = function(node) {
        
        if (node.children.length === 0) { 
            return node;
        }

        
        const bestNode = node.children.reduce((currentBest, child) => {
            if (upperConfidenceBound(child) > upperConfidenceBound(currentBest)) {
                return child;
            }
            else {
                return currentBest;
            }
        });
        // need to expand if best play has been played before but hasn't been expanded
        if (bestNode.plays > 0 && bestNode.children.length === 0) {
            bestNode.expand();
        }
        return bestPlay(bestNode);
    }

    while (i < playouts) {
        // selection - pick the highest value of uct
        const bestNode = bestPlay(rootNode);

        // Random playout
        const playoutWinner = randomPlayout(bestNode.state);
        
        // Backpropagation
        if (playoutWinner === searchingPlayer) {
            let backPropagatingNode = bestNode;
            while (backPropagatingNode !== null) {
                backPropagatingNode.wins++;
                backPropagatingNode.plays++;
            }
        } 
        else {
            let backPropagatingNode = bestNode;
            while (backPropagatingNode !== null) {
                backPropagatingNode.plays++;
            }
        }
    }
}