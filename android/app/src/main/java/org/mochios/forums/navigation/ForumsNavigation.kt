package org.mochios.forums.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import org.mochios.android.push.PendingDeepLink
import org.mochios.forums.ui.find.FindForumsScreen
import org.mochios.forums.ui.forum.ForumScreen
import org.mochios.forums.ui.forumlist.ForumListScreen
import org.mochios.forums.ui.newpost.NewPostScreen
import org.mochios.forums.ui.post.PostScreen
import org.mochios.forums.ui.settings.ForumSettingsScreen

object Routes {
    const val FORUM_LIST = "forumList"
    const val FORUM = "forum/{forumId}"
    const val POST = "forum/{forumId}/post/{postId}"
    const val NEW_POST = "forum/{forumId}/new"
    const val FIND_FORUMS = "findForums"
    const val FORUM_SETTINGS = "forum/{forumId}/settings"

    fun forum(forumId: String) = "forum/$forumId"
    fun post(forumId: String, postId: String) = "forum/$forumId/post/$postId"
    fun newPost(forumId: String) = "forum/$forumId/new"
    fun forumSettings(forumId: String) = "forum/$forumId/settings"
}

@Composable
fun ForumsNavigation(startEntityId: String? = null, onLogout: () -> Unit) {
    val navController = rememberNavController()
    val startDestination = if (startEntityId != null) Routes.forum(startEntityId) else Routes.FORUM_LIST

    // Notification tap → MainActivity stuffed the target path into PendingDeepLink.
    val pendingLink by PendingDeepLink.link.collectAsState()
    LaunchedEffect(pendingLink) {
        val link = pendingLink ?: return@LaunchedEffect
        val forumId = link.trim('/').split('/').getOrNull(1)
        if (!forumId.isNullOrBlank()) {
            navController.navigate(Routes.forum(forumId)) {
                launchSingleTop = true
            }
        }
        PendingDeepLink.consume()
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.FORUM_LIST) {
            ForumListScreen(
                onForumClick = { id -> navController.navigate(Routes.forum(id)) },
                onFindForums = { navController.navigate(Routes.FIND_FORUMS) },
                onLogout = onLogout
            )
        }

        composable(
            route = Routes.FORUM,
            arguments = listOf(navArgument("forumId") { type = NavType.StringType }),
            deepLinks = listOf(
                navDeepLink { uriPattern = "https://{host}/forums/{forumId}" }
            )
        ) {
            ForumScreen(
                onBack = { navController.popBackStack() },
                onPostClick = { fId, pId -> navController.navigate(Routes.post(fId, pId)) },
                onNewPost = { fId -> navController.navigate(Routes.newPost(fId)) },
                onSettings = { fId -> navController.navigate(Routes.forumSettings(fId)) }
            )
        }

        composable(
            route = Routes.POST,
            arguments = listOf(
                navArgument("forumId") { type = NavType.StringType },
                navArgument("postId") { type = NavType.StringType }
            ),
            deepLinks = listOf(
                navDeepLink { uriPattern = "https://{host}/forums/{forumId}/-/{postId}" }
            )
        ) {
            PostScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.NEW_POST,
            arguments = listOf(navArgument("forumId") { type = NavType.StringType })
        ) {
            NewPostScreen(
                onBack = { navController.popBackStack() },
                onPostCreated = { fId, pId ->
                    navController.popBackStack()
                    navController.navigate(Routes.post(fId, pId))
                }
            )
        }

        composable(Routes.FIND_FORUMS) {
            FindForumsScreen(
                onBack = { navController.popBackStack() },
                onForumSubscribed = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.FORUM_SETTINGS,
            arguments = listOf(navArgument("forumId") { type = NavType.StringType })
        ) {
            ForumSettingsScreen(
                onBack = { navController.popBackStack() },
                onForumDeleted = { navController.popBackStack(Routes.FORUM_LIST, inclusive = false) }
            )
        }
    }
}
