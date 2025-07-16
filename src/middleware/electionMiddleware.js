import ElectionState from '../models/electionState.js';

export const checkElectionExpiry = async (req, res, next) => {
    try {
        const electionId = req.params.electionId || req.body.electionId;
        if (!electionId) return next();

        const election = await ElectionState.findById(electionId);
        if (!election) return next();

        if (election.isActive && election.endDate && new Date() > election.endDate) {
            election.isActive = false;
            await election.save();
        }

        req.election = election;
        next();
    } catch (error) {
        next(error);
    }
};