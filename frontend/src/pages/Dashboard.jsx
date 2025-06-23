import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/apiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FolderIcon, 
  CheckCircleIcon, 
  UsersIcon, 
  DocumentTextIcon,
  ClockIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
} from '@heroicons/react/24/outline';

const StatCard = ({ title, value, description, icon: Icon, trend }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {trend && (
        <div className="flex items-center pt-1">
          <TrendingUpIcon className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-500 ml-1">{trend}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const ActivityItem = ({ activity }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'project':
        return FolderIcon;
      case 'task':
        return CheckCircleIcon;
      case 'invoice':
        return DocumentTextIcon;
      default:
        return ClockIcon;
    }
  };

  const Icon = getIcon(activity.type);

  return (
    <div className="flex items-center space-x-4">
      <div className="flex-shrink-0">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {activity.title}
        </p>
        <p className="text-sm text-gray-500">
          {activity.type === 'project' && activity.client?.name}
          {activity.type === 'task' && activity.project?.title}
          {activity.type === 'invoice' && activity.client?.name}
        </p>
      </div>
      <div className="flex-shrink-0 text-sm text-gray-500">
        {new Date(activity.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
};

const DeadlineItem = ({ deadline }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'project':
        return FolderIcon;
      case 'task':
        return CheckCircleIcon;
      default:
        return ClockIcon;
    }
  };

  const Icon = getIcon(deadline.type);
  const dueDate = new Date(deadline.dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex-shrink-0">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {deadline.title}
        </p>
        <p className="text-sm text-gray-500">
          {deadline.client?.name}
        </p>
      </div>
      <div className="flex-shrink-0">
        <span className={`text-sm font-medium ${getPriorityColor(deadline.priority)}`}>
          {daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : `${daysUntilDue} days`}
        </span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => dashboardService.getRecentActivity(5),
  });

  const { data: upcomingDeadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ['upcoming-deadlines'],
    queryFn: () => dashboardService.getUpcomingDeadlines(5),
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your projects.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={overview?.projects?.active || 0}
          description={`${overview?.projects?.total || 0} total projects`}
          icon={FolderIcon}
        />
        <StatCard
          title="Pending Tasks"
          value={(overview?.tasks?.todo || 0) + (overview?.tasks?.inProgress || 0)}
          description={`${overview?.tasks?.completed || 0} completed this month`}
          icon={CheckCircleIcon}
        />
        <StatCard
          title="Active Clients"
          value={overview?.clients?.active || 0}
          description={`${overview?.clients?.newThisMonth || 0} new this month`}
          icon={UsersIcon}
        />
        <StatCard
          title="Pending Revenue"
          value={`$${(overview?.invoices?.pendingAmount || 0).toLocaleString()}`}
          description={`${overview?.invoices?.pendingInvoices || 0} pending invoices`}
          icon={DocumentTextIcon}
        />
      </div>

      {/* Overdue Items Alert */}
      {(overview?.overdue?.projects > 0 || overview?.overdue?.tasks > 0) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Attention Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-700">
              You have {overview.overdue.projects} overdue projects and {overview.overdue.tasks} overdue tasks.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates on your projects and tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-200 h-6 w-6"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity?.activities?.length > 0 ? (
                  recentActivity.activities.map((activity, index) => (
                    <ActivityItem key={index} activity={activity} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No recent activity</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Projects and tasks due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {deadlinesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-200 h-6 w-6"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingDeadlines?.deadlines?.length > 0 ? (
                  upcomingDeadlines.deadlines.map((deadline, index) => (
                    <DeadlineItem key={index} deadline={deadline} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No upcoming deadlines</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

