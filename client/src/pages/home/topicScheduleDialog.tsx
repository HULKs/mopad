import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";

import FlatButton from "material-ui/FlatButton";
import Dialog from "material-ui/Dialog";
import DatePicker from "material-ui/DatePicker";
import TimePicker from "material-ui/TimePicker";
import LocationSelector from "../../app/locationSelector";

interface ScheduleDialogProps {
    open: boolean;
    onSubmit(locationId: string, begin: Date);
    onCancel();
}
interface IntlProps {
    intl: InjectedIntl;
}
interface ScheduleDialogState {
    locationId: string;
    date: Date;
    time: Date;
}

export class DisconnectedScheduleDialog extends React.Component<
    ScheduleDialogProps & IntlProps,
    ScheduleDialogState
> {
    constructor(props) {
        super(props);
        this.state = {
            locationId: "",
            date: new Date(),
            time: new Date()
        };
        this.onSubmit = this.onSubmit.bind(this);
    }

    render() {
        const { open, onCancel, intl } = this.props;
        const { locationId } = this.state;

        const actions = [
            <FlatButton
                label={intl.formatMessage({
                    id: "topic.schedule.dialog.cancel"
                })}
                primary
                onClick={onCancel}
            />,
            <FlatButton
                label={intl.formatMessage({
                    id: "topic.schedule.dialog.submit"
                })}
                primary
                onClick={this.onSubmit}
            />
        ];
        return (
            <Dialog
                title={this.props.intl.formatMessage({
                    id: "topic.schedule.dialog.title"
                })}
                actions={actions}
                open={open}
                onRequestClose={onCancel}
            >
                <div>
                    <label>Select Location:</label>
                    <div>
                        <LocationSelector
                            value={locationId}
                            onChange={id => this.setState({ locationId: id })}
                        />
                    </div>
                </div>
                <div>
                    <label>Select Date:</label>
                    <div>
                        <DatePicker
                            autoOk
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
        const { date, time, locationId } = this.state;
        const combinedDate = new Date();
        combinedDate.setFullYear(date.getFullYear());
        combinedDate.setMonth(date.getMonth());
        combinedDate.setDate(date.getDate());
        combinedDate.setHours(time.getHours());
        combinedDate.setMinutes(time.getMinutes());
        combinedDate.setSeconds(0);
        this.props.onSubmit(locationId, combinedDate);
    }
}

export default injectIntl<ScheduleDialogProps>(DisconnectedScheduleDialog);
