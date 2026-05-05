import { Request, Response, NextFunction } from 'express';
import Topic from '../models/Topic';
import InterviewPrep from '../models/InterviewPrep';

export const getMindMapByTopicId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { topicId } = req.params;
    const topic = await Topic.findById(topicId);

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Ensure the topic belongs to a prep that belongs to the user
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to access this mind map' });
    }

    res.status(200).json(topic.mindMap);
  } catch (err) {
    next(err);
  }
};

export const getMindMapByPrepId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { prepId } = req.params;
    const userId = req.user._id;

    // Verify the prep belongs to the user
    const prep = await InterviewPrep.findOne({ _id: prepId, userId });
    if (!prep) {
      return res.status(404).json({ message: 'Interview prep not found or not authorized' });
    }

    const topics = await Topic.find({ interviewPrepId: prepId });

    // Combine mind maps from all topics
    const combinedMindMap = {
      nodes: topics.flatMap(topic => topic.mindMap?.nodes || []),
      edges: topics.flatMap(topic => topic.mindMap?.edges || []),
    };

    res.status(200).json(combinedMindMap);
  } catch (err) {
    next(err);
  }
};


export const updateMindMapByTopicId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { topicId } = req.params;
    const { nodes, edges } = req.body; // Expecting updated mind map structure

    if (!nodes || !edges) {
      return res.status(400).json({ message: 'Nodes and edges are required for mind map update' });
    }

    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Ensure the topic belongs to a prep that belongs to the user
    const prep = await InterviewPrep.findOne({ _id: topic.interviewPrepId, userId: req.user._id });
    if (!prep) {
      return res.status(401).json({ message: 'Unauthorized to update this mind map' });
    }

    topic.mindMap = { nodes, edges };
    await topic.save();

    res.status(200).json({ message: 'Mind map updated successfully', mindMap: topic.mindMap });
  } catch (err) {
    next(err);
  }
};
