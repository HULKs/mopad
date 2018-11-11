import * as React from "react";
import { FormattedMessage, injectIntl, InjectedIntl } from "react-intl";
import * as Moment from "moment";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/DeleteForever";
import EditIcon from "@material-ui/icons/Edit";
import { TopicViewModel, TopicUpdate } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";
import TopicEditDialog from "./topicEditDialog";
import TopicDeleteDialog from "./topicDeleteDialog";
import Typography from "@material-ui/core/Typography/Typography";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogContent from "@material-ui/core/DialogContent/DialogContent";
import DialogActions from "@material-ui/core/DialogActions/DialogActions";
import OpenIcon from "@material-ui/icons/Visibility";

interface PublicProps {
    topic: TopicViewModel;
    isFullscreen: boolean;
    onChangeParticipation?(topicId: string, as: ParticipationType, action: ParticipationChange);
    onUpdate?(update: TopicUpdate);
    onDelete?(topicId: string);
}

interface IntlProps {
    intl: InjectedIntl;
}

interface TopicState {
    editDialogOpen: boolean;
    deleteDialogOpen: boolean;
    participantDialogOpen: boolean;
}

const topicLabelStyle: React.CSSProperties = {
    display: "inline-block",
    width: 90,
    fontWeight: "bold"
};

export class DisconnectedTopic extends React.Component<PublicProps & IntlProps, TopicState> {
    constructor(props) {
        super(props);
        this.state = {
            editDialogOpen: false,
            deleteDialogOpen: false,
            participantDialogOpen: false
        };
    }
    public render() {
        const { onChangeParticipation, intl, topic, onUpdate, onDelete, isFullscreen } = this.props;
        const { editDialogOpen, deleteDialogOpen, participantDialogOpen } = this.state;

        return (
            <Card className="topic card">
                <CardContent>
                    {!isFullscreen && (
                        <TopicActionIcons
                            show={topic.canManage}
                            onScheduleClick={() => this.setState({ editDialogOpen: true })}
                            onDeleteClick={() => this.setState({ deleteDialogOpen: true })}
                        />
                    )}
                    <Typography variant="h5">
                        {topic.title}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        {topic.description || ""}
                    </Typography>
                    <div style={{ marginTop: 8 }} />
                    <Typography variant="body2" component="div">
                        {topic.location && (
                            <div>
                                <span style={topicLabelStyle}>
                                    <FormattedMessage id="topic.label.location" />:{" "}
                                </span>
                                {topic.location.name}
                            </div>
                        )}

                        {topic.begin && (
                            <div>
                                <span style={topicLabelStyle}>
                                    <FormattedMessage id="topic.label.begin" />:{" "}
                                </span>
                                {Moment(topic.begin).format("dddd h:mma")}
                            </div>
                        )}
                        {(topic.location || topic.begin) && !topic.isTalk && (
                            <div style={{ marginTop: 8 }} />
                        )}
                        {!isFullscreen && !topic.isTalk && (
                            <>
                                <Typography component="div" onClick={() => this.setState({ participantDialogOpen: true })}>
                                    <span style={topicLabelStyle}>
                                        Participants:{" "}
                                    </span>
                                    {topic.experts.length + topic.newbies.length}
                                    <Button size="small">
                                        <OpenIcon style={{ marginRight: "4px", fontSize: "16px" }}/>
                                        Show
                                    </Button>
                                </Typography>
                                <Dialog fullWidth open={participantDialogOpen} onClose={() => this.setState({ participantDialogOpen: false })}>
                                    <DialogContent>
                                        <Typography variant="h6">
                                            <FormattedMessage id="topic.label.expert" />:{" "}
                                        </Typography>
                                        {topic.experts.map(u => <div key={u.id}>{u.team ? `${u.name} (${u.team.name})` : u.name}</div>)}
                                        <Typography variant="h6" style={{ marginTop: "0.5em" }}>
                                            <FormattedMessage id="topic.label.newbie" />:{" "}
                                        </Typography>
                                        {topic.newbies.map(u => <div key={u.id}>{u.team ? `${u.name} (${u.team.name})` : u.name}</div>)}
                                    </DialogContent>
                                    <DialogActions>
                                        <Button onClick={() => this.setState({ participantDialogOpen: false })}>
                                            Close
                                        </Button>
                                    </DialogActions>
                                </Dialog>
                            </>
                        )}
                    </Typography>
                </CardContent>
                {!isFullscreen && (
                    <>
                        <CardActions>
                            <TopicActions
                                topic={topic}
                                onChangeParticipation={onChangeParticipation}
                                intl={intl}
                            />
                        </CardActions>
                        <TopicEditDialog
                            open={editDialogOpen}
                            topic={topic}
                            onSubmit={update => {
                                this.setState({ editDialogOpen: false });
                                onUpdate && onUpdate(update);
                            }}
                            onCancel={() => this.setState({ editDialogOpen: false })}
                        />
                        <TopicDeleteDialog
                            open={deleteDialogOpen}
                            topic={topic}
                            onConfirm={() => {
                                this.setState({ deleteDialogOpen: false });
                                onDelete && onDelete(topic.id);
                            }}
                            onCancel={() => this.setState({ deleteDialogOpen: false })}
                        />
                    </>
                )}
            </Card>
        );
    }
}

function TopicActionIcons({
    show,
    onScheduleClick,
    onDeleteClick
}: {
    show: boolean;
    onScheduleClick?: (event: any) => void;
    onDeleteClick?: (event: any) => void;
}) {
    if (!show) return <div />;

    const divStyle: React.CSSProperties = {
        float: "right"
    };
    const iconOuterStyle = { padding: 0, width: 36, height: 36 };
    return (
        <div style={divStyle}>
            <IconButton style={iconOuterStyle} onClick={onScheduleClick} color="primary">
                <EditIcon />
            </IconButton>
            <IconButton style={iconOuterStyle} onClick={onDeleteClick} color="primary">
                <DeleteIcon />
            </IconButton>
        </div>
    );
}

function TopicActions(props: {
    topic: TopicViewModel;
    onChangeParticipation: PublicProps["onChangeParticipation"];
    intl: InjectedIntl;
}) {
    const { topic, onChangeParticipation, intl } = props;

    if (topic.userIsExpert) {
        return (
            <Button
                color="secondary"
                onClick={() => onChangeParticipation(topic.id, "expert", "leave")}
            >
                {intl.formatMessage({ id: "topic.leave.expert" })}
            </Button>
        );
    }

    if (topic.userIsNewbie) {
        return (
            <Button
                color="secondary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "leave")}
            >
                {intl.formatMessage({ id: "topic.leave.newbie" })}
            </Button>
        );
    }

    if (topic.isTalk) {
        return (
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "join")}
            >
                {intl.formatMessage({ id: "topic.join.talk" })}
            </Button>
        );
    }

    return (
        <div>
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "expert", "join")}
            >
                {intl.formatMessage({ id: "topic.join.expert" })}
            </Button>
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "join")}
            >
                {intl.formatMessage({ id: "topic.join.newbie" })}
            </Button>
        </div>
    );
}

export default injectIntl<PublicProps>(DisconnectedTopic);
