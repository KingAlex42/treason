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
    this.timesPlayed = 0;
    this.parent = parent;

    // Generate the actions allowed by the state:
    this.availableActions

}



let allowedActions = function(state) {
    const currentPhase = state.state.name;
    const phases = shared.states;

    const allowedActions = [];
    
    if (currentPhase == phases.START_OF_TURN) {
        for( let action of shared.actions.keys() ) {
            actionObj = shared.actions[action]
            if (players[state.state.playerIdx].case >= actionObj.cost) {
                if (!actionObj.targeted) {
                    allowedActions.push({
                        command: 'play-action',
                        action: 'action',
                    });
                }
                // need to pick all valid targets - that is, people still in the game
                else {
                    for (let i=0; i < state.state.numPlayers; i++) {
                        if (state.players[i].influenceCount > 0) {
                            allowedActions.push({
                                command: 'play-action',
                                action: 'action',
                                target: i,
                            });
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
    /*
     * In this phase, anyone is allowed to challenge a blocking action
     */
    else if (currentPhase == phases.BLOCK_RESPONSE) {
        allowedActions.concat(['allow', 'challenge']);
    }
    else if (currentPhase == phases.REVEAL_INFLUENCE) {
        if (state.state.responseIDx === state.state.playerToReveal) {
            actions.allowed
        }
    }
}