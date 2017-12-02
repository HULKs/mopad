import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";
import * as Moment from "moment";

import FlatButton from "material-ui/FlatButton";
import Dialog from "material-ui/Dialog";
import TextField from "material-ui/TextField";
import DatePicker from "material-ui/DatePicker";
import TimePicker from "material-ui/TimePicker";
import LocationSelector from "../../app/locationSelector";
import { TopicViewModel, TopicUpdate } from "../../business/topics";

interface EditDialogProps {
    open: boolean;
    topic: TopicViewModel;
    onSubmit(update: TopicUpdate);
    onCancel();
}
interface IntlProps {
    intl: InjectedIntl;
}
interface EditDialogState {
    data: TopicUpdate;
    date: Date;
    time: Date;
}

export class DisconnectedEditDialog extends React.Component<
    EditDialogProps & IntlProps,
    EditDialogState
> {
    constructor(props: EditDialogProps & IntlProps) {
        super(props);
        const { topic } = props;
        const begin = topic.begin ? Moment(topic.begin).toDate() : null;

        this.state = {
            data: {
                id: topic.id,
                title: topic.title,
                description: topic.description || "",
                begin: begin,
                locationId: topic.location ? topic.location.id : null,
                oldLocationId: topic.location ? topic.location.id : null
            },
            date: begin,
            time: begin
        };
        this.onSubmit = this.onSubmit.bind(this);
    }

    render() {
        const { open, onCancel, intl } = this.props;
        const { data, date, time } = this.state;

        const actions = [
            <FlatButton
                label={intl.formatMessage({
                    id: "topic.edit.dialog.cancel"
                })}
                primary
                onClick={onCancel}
            />,
            <FlatButton
                label={intl.formatMessage({
                    id: "topic.edit.dialog.submit"
                })}
                primary
                onClick={this.onSubmit}
            />
        ];
        return (
            <Dialog
                title={this.props.intl.formatMessage({
                    id: "topic.edit.dialog.title"
                })}
                actions={actions}
                open={open}
                onRequestClose={onCancel}
                autoScrollBodyContent
            >
                <div>
                    <label>Title:</label>
                    <div>
                        <TextField
                            fullWidth
                            value={data.title}
                            onChange={(e, val) => {
                                this.setState({
                                    data: { ...data, title: val }
                                });
                            }}
                        />
                    </div>
                </div>
                <div>
                    <label>Description:</label>
                    <div>
                        <TextField
                            fullWidth
                            value={data.description}
                            onChange={(e, val) => {
                                this.setState({
                                    data: { ...data, description: val }
                                });
                            }}
                        />
                    </div>
                </div>
                <div>
                    <label>Select Location:</label>
                    <div>
                        <LocationSelector
                            value={data.locationId}
                            onChange={id =>
                                this.setState({
                                    data: { ...data, locationId: id }
                                })
                            }
                        />
                    </div>
                </div>
                <div>
                    <label>Select Date:</label>
                    <div>
                        <DatePicker
                            autoOk
                            value={date}
                            onChange={(e, date) =>
                                this.setState({ date: date })
                            }
                        />
                    </div>
                </div>
                <div>
                    <label>Select Time:</label>
                    <div>
                        <TimePicker
                            format="24hr"
                            minutesStep={5}
                            value={time}
                            onChange={(e, time) => {
                                this.setState({ time: time });
                            }}
                        />
                    </div>
                </div>
            </Dialog>
        );
    }

    private onSubmit() {
        const { date, time, data } = this.state;

        if (date === null || time === null) {
            data.begin = null;
        } else {
            data.begin = new Date();
            data.begin.setFullYear(date.getFullYear());
            data.begin.setMonth(date.getMonth());
            data.begin.setDate(date.getDate());
            data.begin.setHours(time.getHours());
            data.begin.setMinutes(time.getMinutes());
            data.begin.setSeconds(0);
        }
        this.props.onSubmit(data);
    }
}

export default injectIntl<EditDialogProps>(DisconnectedEditDialog);
